import { Bash, InMemoryFs } from 'just-bash/browser'
import {
  WORKSPACE_ROOT,
  createShellState,
  dirname,
  ensureWorkspaceAbsolute,
  isDerivedWorkspacePath,
  resolveFrom,
  sortWorkspacePaths,
  type ShellState,
  type WorkspaceSnapshot,
} from './workspace'

export type BashExecution = {
  stdout: string
  stderr: string
  exitCode: number
  workspace: WorkspaceSnapshot
  shellState: ShellState
}

type CommandPart = {
  command: string
  joiner: '&&' | ';' | null
}

function isSimpleCommand(command: string, name: string) {
  return new RegExp(`^${name}(?:\\s+.*)?$`).test(command.trim())
}

function splitCommandParts(command: string): CommandPart[] {
  const parts: CommandPart[] = []
  let current = ''
  let quote: 'single' | 'double' | null = null
  let escaping = false

  function push(joiner: '&&' | ';' | null) {
    const trimmed = current.trim()
    if (trimmed) {
      parts.push({ command: trimmed, joiner })
    }
    current = ''
  }

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index]
    const nextCharacter = command[index + 1]

    if (escaping) {
      current += character
      escaping = false
      continue
    }

    if (character === '\\' && quote !== 'single') {
      current += character
      escaping = true
      continue
    }

    if (character === "'" && quote !== 'double') {
      quote = quote === 'single' ? null : 'single'
      current += character
      continue
    }

    if (character === '"' && quote !== 'single') {
      quote = quote === 'double' ? null : 'double'
      current += character
      continue
    }

    if (!quote && character === '&' && nextCharacter === '&') {
      push('&&')
      index += 1
      continue
    }

    if (!quote && character === ';') {
      push(';')
      continue
    }

    current += character
  }

  push(null)
  return parts
}

async function ensureDirectory(fs: InMemoryFs, path: string) {
  if (path === '/' || (await fs.exists(path))) {
    return
  }

  await fs.mkdir(path, { recursive: true })
}

export class BashWorkspace {
  readonly fs: InMemoryFs
  private readonly bash: Bash

  constructor() {
    this.fs = new InMemoryFs()
    this.bash = new Bash({ fs: this.fs, cwd: WORKSPACE_ROOT })
  }

  async hydrate(snapshot: WorkspaceSnapshot) {
    for (const dir of sortWorkspacePaths(snapshot.directories)) {
      await ensureDirectory(this.fs, dir)
    }

    for (const [path, content] of Object.entries(snapshot.files)) {
      await ensureDirectory(this.fs, dirname(path))
      await this.fs.writeFile(path, content, 'utf8')
    }
  }

  async snapshotWorkspace(): Promise<WorkspaceSnapshot> {
    const files: Record<string, string> = {}
    const directories = new Set<string>([WORKSPACE_ROOT])

    for (const path of this.fs.getAllPaths()) {
      if (!path.startsWith(WORKSPACE_ROOT) || isDerivedWorkspacePath(path)) {
        continue
      }

      const stats = await this.fs.stat(path)
      if (stats.isDirectory) {
        directories.add(path)
        continue
      }

      files[path] = await this.fs.readFile(path, 'utf8')
      directories.add(dirname(path))
    }

    return {
      files,
      directories: sortWorkspacePaths(Array.from(directories)),
    }
  }

  async writeFile(path: string, content: string) {
    await ensureDirectory(this.fs, dirname(path))
    await this.fs.writeFile(path, content, 'utf8')
  }

  async readFile(path: string) {
    return this.fs.readFile(path, 'utf8')
  }

  async mkdir(path: string) {
    await this.fs.mkdir(path, { recursive: true })
  }

  async rm(path: string) {
    await this.fs.rm(path, { recursive: true, force: true })
  }

  async mv(sourcePath: string, targetPath: string) {
    await ensureDirectory(this.fs, dirname(targetPath))
    await this.fs.mv(sourcePath, targetPath)
  }

  private async execSingle(command: string, shellState: ShellState): Promise<BashExecution> {
    const trimmed = command.trim()
    const nextShellState = createShellState({
      cwd: shellState.cwd,
      env: shellState.env,
      history: [...shellState.history, trimmed].slice(-200),
    })

    if (isSimpleCommand(trimmed, 'cd')) {
      const rawTarget = trimmed.replace(/^cd\s*/, '') || WORKSPACE_ROOT
      const nextPath = resolveFrom(shellState.cwd, rawTarget)

      try {
        const stats = await this.fs.stat(nextPath)
        if (!stats.isDirectory) {
          return {
            stdout: '',
            stderr: `cd: not a directory: ${rawTarget}\n`,
            exitCode: 1,
            workspace: await this.snapshotWorkspace(),
            shellState: nextShellState,
          }
        }
      } catch {
        return {
          stdout: '',
          stderr: `cd: no such file or directory: ${rawTarget}\n`,
          exitCode: 1,
          workspace: await this.snapshotWorkspace(),
          shellState: nextShellState,
        }
      }

      return {
        stdout: '',
        stderr: '',
        exitCode: 0,
        workspace: await this.snapshotWorkspace(),
        shellState: {
          ...nextShellState,
          cwd: nextPath,
        },
      }
    }

    if (isSimpleCommand(trimmed, 'export')) {
      const assignment = trimmed.replace(/^export\s+/, '')
      const [name, ...rest] = assignment.split('=')
      if (!name || rest.length === 0) {
        return {
          stdout: '',
          stderr: 'export: usage: export NAME=value\n',
          exitCode: 2,
          workspace: await this.snapshotWorkspace(),
          shellState: nextShellState,
        }
      }

      return {
        stdout: '',
        stderr: '',
        exitCode: 0,
        workspace: await this.snapshotWorkspace(),
        shellState: {
          ...nextShellState,
          env: {
            ...nextShellState.env,
            [name]: rest.join('=').replace(/^['"]|['"]$/g, ''),
          },
        },
      }
    }

    const result = await this.bash.exec(trimmed, {
      cwd: shellState.cwd,
      env: shellState.env,
    })

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      workspace: await this.snapshotWorkspace(),
      shellState: nextShellState,
    }
  }

  async exec(command: string, shellState: ShellState): Promise<BashExecution> {
    const parts = splitCommandParts(command)
    if (parts.length <= 1) {
      return this.execSingle(command, shellState)
    }

    let currentShellState = shellState
    let currentWorkspace = await this.snapshotWorkspace()
    let stdout = ''
    let stderr = ''
    let exitCode = 0

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index]
      const result = await this.execSingle(part.command, currentShellState)
      currentShellState = result.shellState
      currentWorkspace = result.workspace
      stdout += result.stdout
      stderr += result.stderr
      exitCode = result.exitCode

      if (result.exitCode !== 0 && part.joiner === '&&') {
        break
      }
    }

    return {
      stdout,
      stderr,
      exitCode,
      workspace: currentWorkspace,
      shellState: currentShellState,
    }
  }

  async applyRuntimeWrite(path: string, content: string) {
    await this.writeFile(ensureWorkspaceAbsolute(path), content)
  }

  async applyRuntimeMkdir(path: string) {
    await this.mkdir(ensureWorkspaceAbsolute(path))
  }

  async applyRuntimeRemove(path: string) {
    await this.rm(ensureWorkspaceAbsolute(path))
  }

  async applyRuntimeMove(oldPath: string, newPath: string) {
    await this.mv(ensureWorkspaceAbsolute(oldPath), ensureWorkspaceAbsolute(newPath))
  }
}
