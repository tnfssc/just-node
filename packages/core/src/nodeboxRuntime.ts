import { Nodebox, type FileWatchEvent, type ShellProcess } from '@codesandbox/nodebox'
import {
  isDerivedWorkspacePath,
  nodeboxToWorkspacePath,
  toNodeboxDirectories,
  toNodeboxFiles,
  workspaceToNodeboxPath,
  type WorkspaceSnapshot,
} from './workspace'

export type RuntimeFsEvent =
  | { type: 'writeFile'; path: string; content: string }
  | { type: 'mkdir'; path: string }
  | { type: 'remove'; path: string }
  | { type: 'move'; oldPath: string; newPath: string }

export type RuntimeRunOptions = {
  command: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
  onExit?: (exitCode: number, error?: { message: string }) => void
}

export type RuntimeBarrierOptions = {
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
}

export class NodeboxRuntime {
  private nodebox: Nodebox | null = null
  private watcher: { dispose: () => Promise<void> } | null = null
  private shells = new Map<string, ShellProcess>()

  async connect(iframe: HTMLIFrameElement) {
    if (this.nodebox) {
      return
    }

    const nodebox = new Nodebox({ iframe })
    await nodebox.connect()
    this.nodebox = nodebox
  }

  async hydrate(snapshot: WorkspaceSnapshot) {
    if (!this.nodebox) {
      throw new Error('Nodebox is not connected')
    }

    await this.nodebox.fs.init(toNodeboxFiles(snapshot))

    for (const dir of toNodeboxDirectories(snapshot)) {
      await this.nodebox.fs.mkdir(dir, { recursive: true })
    }
  }

  async sync(snapshot: WorkspaceSnapshot, previousSnapshot?: WorkspaceSnapshot) {
    if (!this.nodebox) {
      throw new Error('Nodebox is not connected')
    }

    if (previousSnapshot) {
      const previousFiles = new Set(Object.keys(toNodeboxFiles(previousSnapshot)))
      const nextFiles = new Set(Object.keys(toNodeboxFiles(snapshot)))
      const previousDirs = new Set(toNodeboxDirectories(previousSnapshot))
      const nextDirs = new Set(toNodeboxDirectories(snapshot))

      for (const filePath of previousFiles) {
        if (!nextFiles.has(filePath)) {
          await this.nodebox.fs.rm(filePath, { force: true })
        }
      }

      for (const dirPath of Array.from(previousDirs).sort((left, right) => right.length - left.length)) {
        if (!nextDirs.has(dirPath)) {
          await this.nodebox.fs.rm(dirPath, { recursive: true, force: true })
        }
      }
    }

    for (const dirPath of toNodeboxDirectories(snapshot)) {
      await this.nodebox.fs.mkdir(dirPath, { recursive: true })
    }

    for (const [filePath, content] of Object.entries(toNodeboxFiles(snapshot))) {
      await this.nodebox.fs.writeFile(filePath, content, { recursive: true })
    }
  }

  async writeFile(path: string, content: string) {
    if (!this.nodebox) {
      throw new Error('Nodebox is not connected')
    }

    await this.nodebox.fs.writeFile(path, content, { recursive: true })
  }

  async mkdir(path: string) {
    if (!this.nodebox) {
      throw new Error('Nodebox is not connected')
    }

    await this.nodebox.fs.mkdir(path, { recursive: true })
  }

  async watch(listener: (event: RuntimeFsEvent) => Promise<void>) {
    if (!this.nodebox) {
      throw new Error('Nodebox is not connected')
    }

    await this.watcher?.dispose()

    this.watcher = await this.nodebox.fs.watch(['**/*'], [], async (event?: FileWatchEvent) => {
      const nodebox = this.nodebox
      if (!event || event.type === 'close') {
        return
      }

      if (!nodebox) {
        return
      }

      if (event.type === 'remove') {
        const path = ('path' in event ? event.path : '') as string
        const workspacePath = nodeboxToWorkspacePath(path)
        if (isDerivedWorkspacePath(workspacePath)) {
          return
        }
        await listener({ type: 'remove', path: workspacePath })
        return
      }

      if (event.type === 'rename') {
        const oldPath = ('oldPath' in event ? event.oldPath : '') as string
        const newPath = ('newPath' in event ? event.newPath : '') as string
        const workspaceOldPath = nodeboxToWorkspacePath(oldPath)
        const workspaceNewPath = nodeboxToWorkspacePath(newPath)
        if (isDerivedWorkspacePath(workspaceOldPath) || isDerivedWorkspacePath(workspaceNewPath)) {
          return
        }
        await listener({ type: 'move', oldPath: workspaceOldPath, newPath: workspaceNewPath })
        return
      }

      const path = ('path' in event ? event.path : '') as string
      const workspacePath = nodeboxToWorkspacePath(path)
      if (isDerivedWorkspacePath(workspacePath)) {
        return
      }

      const stats = await nodebox.fs.stat(path)
      if (stats.type === 'dir') {
        await listener({ type: 'mkdir', path: workspacePath })
        return
      }

      const content = await nodebox.fs.readFile(path, 'utf8')
      await listener({ type: 'writeFile', path: workspacePath, content })
    })
  }

  async run(processKey: string, options: RuntimeRunOptions) {
    if (!this.nodebox) {
      throw new Error('Nodebox is not connected')
    }

    await this.stop(processKey)

    const shell = this.nodebox.shell.create()
    this.shells.set(processKey, shell)
    shell.stdout.on('data', (chunk) => options.onStdout?.(chunk))
    shell.stderr.on('data', (chunk) => options.onStderr?.(chunk))
    await shell.on('exit', (exitCode, error) => {
      if (this.shells.get(processKey) === shell) {
        this.shells.delete(processKey)
      }
      options.onExit?.(exitCode, error)
    })

    const info = await shell.runCommand(options.command, options.args, {
      cwd: options.cwd,
      env: options.env,
    })

    let previewUrl: string | null = null
    try {
      const preview = await this.nodebox.preview.getByShellId(info.id, 8000)
      previewUrl = preview.url
    } catch {
      previewUrl = null
    }

    return {
      shellId: info.id,
      previewUrl,
    }
  }

  async waitForDependencySync(options?: RuntimeBarrierOptions) {
    if (!this.nodebox) {
      throw new Error('Nodebox is not connected')
    }

    const shell = this.nodebox.shell.create()
    shell.stdout.on('data', (chunk) => options?.onStdout?.(chunk))
    shell.stderr.on('data', (chunk) => options?.onStderr?.(chunk))

    return new Promise<void>((resolve, reject) => {
      let settled = false

      void shell.on('exit', (exitCode, error) => {
        if (settled) {
          return
        }

        settled = true
        if (error) {
          reject(new Error(error.message))
          return
        }

        if (exitCode !== 0) {
          reject(new Error(`Dependency sync failed with exit code ${exitCode}`))
          return
        }

        resolve()
      })

      void shell.runCommand('node', ['-e', 'process.exit(0)']).catch((error) => {
        if (settled) {
          return
        }

        settled = true
        reject(error)
      })
    })
  }

  async stop(processKey?: string) {
    if (processKey) {
      const shell = this.shells.get(processKey)
      if (shell) {
        await shell.kill()
        this.shells.delete(processKey)
      }
      return
    }

    await Promise.all(
      Array.from(this.shells.values()).map(async (shell) => {
        await shell.kill()
      }),
    )
    this.shells.clear()
  }

  async dispose() {
    await this.stop()
    await this.watcher?.dispose()
    this.watcher = null
    this.nodebox = null
  }
}

export function mapWorkspaceCwdToNodebox(cwd: string) {
  return workspaceToNodeboxPath(cwd)
}
