import { BashWorkspace } from './bashWorkspace'
import {
  createInputLine,
  mapArgToNodebox,
  outputLines,
  parseDependencySpec,
  parsePackageScript,
  splitShellWords,
} from './commands'
import { mapWorkspaceCwdToNodebox, NodeboxRuntime, type RuntimeFsEvent } from './nodeboxRuntime'
import { exportSessionArchive, fileNameForSessionArchive, importSessionArchive } from './sessionArchive'
import {
  WORKSPACE_ROOT,
  appendTranscript,
  basename,
  cloneWorkspaceSnapshot,
  createSessionSnapshot,
  createShellState,
  createTerminalTab,
  createTranscriptLine,
  formatTerminalTabTitle,
  loadWorkbenchState,
  nowIso,
  sameWorkspace,
  saveWorkbenchState,
  type SessionSnapshot,
  type ShellState,
  type TerminalTabSnapshot,
  type TranscriptLine,
  type WorkbenchState,
  type WorkspaceSnapshot,
} from './workspace'

export type TerminalWorkbenchSnapshot = {
  workbench: WorkbenchState
  activeSession: SessionSnapshot | undefined
  activeTab: TerminalTabSnapshot | undefined
  statusMessage: string
  runtimeReady: boolean
}

type SnapshotListener = (snapshot: TerminalWorkbenchSnapshot) => void

type ResolvedDependency = {
  name: string
  version: string
}

async function resolveDependencyVersion(spec: { name: string; version: string }): Promise<ResolvedDependency> {
  if (spec.version && spec.version !== 'latest') {
    return spec
  }

  const encodedName = spec.name.replace('/', '%2f')
  const response = await fetch(`https://registry.npmjs.org/${encodedName}/latest`)
  if (!response.ok) {
    throw new Error(`Unable to resolve latest version for ${spec.name}`)
  }

  const metadata = (await response.json()) as { version?: string }
  if (!metadata.version) {
    throw new Error(`Registry response for ${spec.name} did not include a version`)
  }

  return {
    name: spec.name,
    version: metadata.version,
  }
}

function sessionNameForIndex(index: number) {
  return `Session ${index}`
}

function replaceSession(
  workbench: WorkbenchState,
  sessionId: string,
  updater: (session: SessionSnapshot) => SessionSnapshot,
) {
  return {
    ...workbench,
    sessions: workbench.sessions.map((session) => {
      if (session.id !== sessionId) {
        return session
      }

      return {
        ...updater(session),
        updatedAt: nowIso(),
      }
    }),
  }
}

function activeSessionFrom(state: WorkbenchState) {
  return state.sessions.find((session) => session.id === state.activeSessionId) ?? state.sessions[0]
}

function activeTabFrom(session: SessionSnapshot | undefined) {
  if (!session) {
    return undefined
  }

  return session.terminalTabs.find((tab) => tab.id === session.activeTerminalTabId) ?? session.terminalTabs[0]
}

function updateTab(session: SessionSnapshot, tabId: string, updater: (tab: TerminalTabSnapshot) => TerminalTabSnapshot) {
  return {
    ...session,
    terminalTabs: session.terminalTabs.map((tab) => (tab.id === tabId ? updater(tab) : tab)),
  }
}

export class TerminalWorkbenchController {
  private workbench: WorkbenchState
  private statusMessage = 'Ready'
  private runtimeReady = false
  private bridgeFrame: HTMLIFrameElement | null = null
  private listeners = new Set<SnapshotListener>()
  private bash: BashWorkspace | null = null
  private nodebox: NodeboxRuntime | null = null
  private syncingNodebox = 0
  private runtimeBootPromise: Promise<void> | null = null
  private bootRevision = 0

  constructor(initialState: WorkbenchState = loadWorkbenchState()) {
    this.workbench = initialState
  }

  getSnapshot(): TerminalWorkbenchSnapshot {
    const activeSession = activeSessionFrom(this.workbench)
    return {
      workbench: this.workbench,
      activeSession,
      activeTab: activeTabFrom(activeSession),
      statusMessage: this.statusMessage,
      runtimeReady: this.runtimeReady,
    }
  }

  subscribe(listener: SnapshotListener) {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  async attachBridgeFrame(frame: HTMLIFrameElement | null) {
    if (this.bridgeFrame === frame) {
      return
    }

    this.bridgeFrame = frame
    await this.bootRuntime()
  }

  async dispose() {
    this.bootRevision += 1
    this.runtimeBootPromise = null
    this.runtimeReady = false
    this.emit()
    await this.disposeRuntimeResources()
  }

  private emit() {
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }

  private setStatusMessage(message: string) {
    this.statusMessage = message
    this.emit()
  }

  private setRuntimeReady(value: boolean) {
    this.runtimeReady = value
    this.emit()
  }

  private setWorkbench(next: WorkbenchState) {
    const previousActiveSessionId = this.workbench.activeSessionId
    this.workbench = next
    saveWorkbenchState(next)
    this.emit()

    if (next.activeSessionId !== previousActiveSessionId) {
      void this.bootRuntime()
    }
  }

  private mutateSession(sessionId: string, mutator: (session: SessionSnapshot) => SessionSnapshot) {
    this.setWorkbench(replaceSession(this.workbench, sessionId, mutator))
  }

  private mutateActiveSession(mutator: (session: SessionSnapshot) => SessionSnapshot) {
    this.mutateSession(this.workbench.activeSessionId, mutator)
  }

  private appendLinesToTab(sessionId: string, tabId: string, lines: TranscriptLine[]) {
    this.mutateSession(sessionId, (session) =>
      updateTab(session, tabId, (tab) => ({
        ...tab,
        transcript: appendTranscript(tab.transcript, lines),
      })),
    )
  }

  private async disposeRuntimeResources() {
    this.bash = null
    const runtime = this.nodebox
    this.nodebox = null
    if (runtime) {
      await runtime.dispose()
    }
  }

  private async bootRuntime() {
    const session = activeSessionFrom(this.workbench)
    const frame = this.bridgeFrame
    const revision = ++this.bootRevision

    this.runtimeBootPromise = null
    this.setRuntimeReady(false)
    await this.disposeRuntimeResources()

    if (!frame || !session) {
      if (!frame) {
        this.setStatusMessage('Bridge offline')
      }
      return
    }

    const bash = new BashWorkspace()
    const runtime = new NodeboxRuntime()

    const bootPromise = (async () => {
      this.setStatusMessage(`Booting ${session.name}...`)
      await bash.hydrate(session.workspace)
      if (revision !== this.bootRevision) {
        return
      }

      this.bash = bash
      await runtime.connect(frame)
      await runtime.hydrate(session.workspace)
      await runtime.watch(async (event: RuntimeFsEvent) => {
        if (revision !== this.bootRevision || this.syncingNodebox > 0 || !this.bash) {
          return
        }

        if (event.type === 'writeFile') {
          await this.bash.applyRuntimeWrite(event.path, event.content)
        } else if (event.type === 'mkdir') {
          await this.bash.applyRuntimeMkdir(event.path)
        } else if (event.type === 'remove') {
          await this.bash.applyRuntimeRemove(event.path)
        } else if (event.type === 'move') {
          await this.bash.applyRuntimeMove(event.oldPath, event.newPath)
        }

        const nextWorkspace = await this.bash.snapshotWorkspace()
        this.mutateSession(session.id, (entry) => ({
          ...entry,
          workspace: cloneWorkspaceSnapshot(nextWorkspace),
        }))
      })

      if (revision !== this.bootRevision) {
        await runtime.dispose()
        return
      }

      this.nodebox = runtime
      this.setRuntimeReady(true)
      this.setStatusMessage(`${session.name} ready`)
    })()

    this.runtimeBootPromise = bootPromise

    void bootPromise.catch((error: unknown) => {
      if (revision !== this.bootRevision) {
        return
      }

      this.runtimeBootPromise = null
      this.setRuntimeReady(false)
      this.setStatusMessage(`Runtime error: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  private async syncNodebox(nextWorkspace: WorkspaceSnapshot, previousWorkspace: WorkspaceSnapshot) {
    if (!this.nodebox || sameWorkspace(nextWorkspace, previousWorkspace)) {
      return
    }

    this.syncingNodebox += 1
    try {
      await this.nodebox.sync(nextWorkspace, previousWorkspace)
    } finally {
      this.syncingNodebox -= 1
    }
  }

  private async replaceActiveWorkspace(nextWorkspace: WorkspaceSnapshot, previousWorkspace: WorkspaceSnapshot) {
    this.mutateActiveSession((session) => ({
      ...session,
      workspace: cloneWorkspaceSnapshot(nextWorkspace),
    }))
    await this.syncNodebox(nextWorkspace, previousWorkspace)
  }

  private async runRuntimeCommand(
    sessionId: string,
    tabId: string,
    shellState: ShellState,
    command: string,
    args: string[],
    envOverrides?: Record<string, string>,
  ) {
    if (!this.nodebox && this.runtimeBootPromise) {
      this.appendLinesToTab(sessionId, tabId, [createTranscriptLine('system', 'Waiting for runtime...')])
      await this.runtimeBootPromise.catch(() => undefined)
    }

    const runtime = this.nodebox
    if (!runtime) {
      this.appendLinesToTab(sessionId, tabId, [createTranscriptLine('stderr', 'Runtime is still booting.')])
      return
    }

    this.mutateSession(sessionId, (session) =>
      updateTab(session, tabId, (tab) => ({
        ...tab,
        process: {
          status: 'running',
          lastCommand: `${command} ${args.join(' ')}`.trim(),
          lastExitCode: null,
        },
      })),
    )

    const result = await runtime.run(tabId, {
      command,
      args,
      cwd: mapWorkspaceCwdToNodebox(shellState.cwd),
      env: {
        ...shellState.env,
        ...envOverrides,
      },
      onStdout: (chunk) => {
        this.appendLinesToTab(sessionId, tabId, outputLines('stdout', chunk))
      },
      onStderr: (chunk) => {
        this.appendLinesToTab(sessionId, tabId, outputLines('stderr', chunk))
      },
      onExit: (exitCode, error) => {
        this.mutateSession(sessionId, (session) =>
          updateTab(session, tabId, (tab) => ({
            ...tab,
            process: {
              status: error ? 'error' : 'idle',
              lastCommand: tab.process.lastCommand,
              lastExitCode: exitCode,
            },
          })),
        )

        if (error) {
          this.appendLinesToTab(sessionId, tabId, [createTranscriptLine('stderr', `Runtime error: ${error.message}`)])
        }
      },
    })

    if (result.previewUrl) {
      this.appendLinesToTab(sessionId, tabId, [createTranscriptLine('system', `Preview ready at ${result.previewUrl}`)])
      return
    }

    window.setTimeout(() => {
      this.mutateSession(sessionId, (session) =>
        updateTab(session, tabId, (tab) => {
          if (tab.process.status !== 'running') {
            return tab
          }

          return {
            ...tab,
            process: {
              status: 'idle',
              lastCommand: tab.process.lastCommand,
              lastExitCode: tab.process.lastExitCode ?? 0,
            },
          }
        }),
      )
    }, 800)
  }

  private async handleNpmCommand(sessionId: string, tabId: string, shellState: ShellState, command: string) {
    const words = splitShellWords(command)
    const subcommand = words[1]
    const bash = this.bash
    const session = activeSessionFrom(this.workbench)
    if (!bash || !session) {
      return
    }

    if (subcommand === 'install' || subcommand === 'i' || subcommand === 'uninstall' || subcommand === 'remove' || subcommand === 'rm') {
      const isInstall = subcommand === 'install' || subcommand === 'i'
      const isDev = words.includes('-D') || words.includes('--save-dev')
      const packageArgs = words.slice(2).filter((value) => !['-D', '--save-dev'].includes(value))
      const requestedPackages = packageArgs
        .map(parseDependencySpec)
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

      if (!isInstall && requestedPackages.length === 0) {
        this.appendLinesToTab(sessionId, tabId, [
          createTranscriptLine('stderr', `usage: npm ${subcommand} ${isInstall ? '[-D] ' : ''}<pkg...>`),
        ])
        return
      }

      this.mutateSession(sessionId, (current) =>
        updateTab(current, tabId, (tab) => ({
          ...tab,
          process: {
            status: 'running',
            lastCommand: command,
            lastExitCode: null,
          },
        })),
      )

      try {
        const previousWorkspace = session.workspace
        const packagePath = `${WORKSPACE_ROOT}/package.json`
        let parsed: {
          name?: string
          private?: boolean
          type?: string
          dependencies?: Record<string, string>
          devDependencies?: Record<string, string>
        }

        try {
          parsed = JSON.parse(await bash.readFile(packagePath)) as typeof parsed
        } catch {
          parsed = {
            name: 'browser-terminal-workspace',
            private: true,
            type: 'module',
            dependencies: {},
            devDependencies: {},
          }
        }

        let packages = requestedPackages
        if (isInstall && requestedPackages.length > 0) {
          this.appendLinesToTab(sessionId, tabId, [createTranscriptLine('system', 'Resolving package versions from npm registry...')])
          packages = await Promise.all(requestedPackages.map(resolveDependencyVersion))
        }

        if (isInstall) {
          const target = isDev ? (parsed.devDependencies ??= {}) : (parsed.dependencies ??= {})
          for (const pkg of packages) {
            target[pkg.name] = pkg.version
          }
        } else {
          for (const pkg of packages) {
            delete parsed.dependencies?.[pkg.name]
            delete parsed.devDependencies?.[pkg.name]
          }
        }

        await bash.writeFile(packagePath, `${JSON.stringify(parsed, null, 2)}\n`)
        const nextWorkspace = await bash.snapshotWorkspace()
        await this.replaceActiveWorkspace(nextWorkspace, previousWorkspace)

        const packageNames = packages.map((entry) => entry.name)

        this.appendLinesToTab(sessionId, tabId, [
          createTranscriptLine(
            'system',
            isInstall
              ? packageNames.length > 0
                ? `Queued dependency sync for ${packageNames.map((name, index) => `${name}@${packages[index]?.version ?? 'latest'}`).join(', ')}.`
                : 'Queued dependency sync for package.json.'
              : `Queued dependency removal for ${packageNames.join(', ')}.`,
          ),
        ])

        this.appendLinesToTab(sessionId, tabId, [
          createTranscriptLine(
            'stdout',
            isInstall
              ? packageNames.length > 0
                ? `installed ${packageNames.join(', ')}`
                : 'dependencies synchronized'
              : `removed ${packageNames.join(', ')}`,
          ),
        ])
        this.appendLinesToTab(sessionId, tabId, [
          createTranscriptLine('system', 'Dependencies will be resolved by Nodebox on the next runtime command.'),
        ])
        this.mutateSession(sessionId, (current) =>
          updateTab(current, tabId, (tab) => ({
            ...tab,
            process: {
              status: 'idle',
              lastCommand: command,
              lastExitCode: 0,
            },
          })),
        )
      } catch (error) {
        this.appendLinesToTab(sessionId, tabId, [
          createTranscriptLine('stderr', `npm ${subcommand} failed: ${error instanceof Error ? error.message : String(error)}`),
        ])
        this.mutateSession(sessionId, (current) =>
          updateTab(current, tabId, (tab) => ({
            ...tab,
            process: {
              status: 'error',
              lastCommand: command,
              lastExitCode: 1,
            },
          })),
        )
      }

      return
    }

    if (subcommand === 'run') {
      const script = words[2]
      if (!script) {
        this.appendLinesToTab(sessionId, tabId, [createTranscriptLine('stderr', 'usage: npm run <script>')])
        return
      }

      const packageJson = JSON.parse(session.workspace.files[`${WORKSPACE_ROOT}/package.json`] ?? '{}') as {
        scripts?: Record<string, string>
      }
      const scriptCommand = packageJson.scripts?.[script]
      if (!scriptCommand) {
        this.appendLinesToTab(sessionId, tabId, [createTranscriptLine('stderr', `missing script: ${script}`)])
        return
      }

      const parsed = parsePackageScript(scriptCommand)
      const extraArgs = words.slice(3)
      if (extraArgs[0] === '--') {
        extraArgs.shift()
      }

      await this.runRuntimeCommand(sessionId, tabId, shellState, parsed.command, [...parsed.args, ...extraArgs], parsed.env)
      return
    }

    this.appendLinesToTab(sessionId, tabId, [createTranscriptLine('stderr', 'supported npm commands: install, uninstall, run')])
  }

  private async handleNodeCommand(sessionId: string, tabId: string, shellState: ShellState, command: string) {
    const words = splitShellWords(command)
    if (words.length < 2) {
      this.appendLinesToTab(sessionId, tabId, [createTranscriptLine('stderr', 'usage: node <file> [args...]')])
      return
    }

    const [firstArg, ...restArgs] = words.slice(1)

    if (firstArg === '-c' || firstArg === '--check') {
      this.appendLinesToTab(sessionId, tabId, [
        createTranscriptLine('stderr', '`node -c` only checks syntax and does not execute code. Use `node -e` to run inline JavaScript.'),
      ])
      return
    }

    if (firstArg === '-e' || firstArg === '--eval') {
      const runtime = this.nodebox
      if (!runtime) {
        this.appendLinesToTab(sessionId, tabId, [createTranscriptLine('stderr', 'Runtime is still booting.')])
        return
      }

      const source = restArgs.join(' ')
      if (!source) {
        this.appendLinesToTab(sessionId, tabId, [createTranscriptLine('stderr', 'usage: node -e "<script>"')])
        return
      }

      const runtimeCwd = mapWorkspaceCwdToNodebox(shellState.cwd)
      const storageBase = runtimeCwd === '/' ? '.runtime-inline' : `${runtimeCwd.replace(/^\//, '')}/.runtime-inline`
      const fileName = `inline-${Date.now()}.mjs`
      await runtime.mkdir(storageBase)
      await runtime.writeFile(`${storageBase}/${fileName}`, source)
      await this.runRuntimeCommand(sessionId, tabId, shellState, 'node', [`./.runtime-inline/${fileName}`])
      return
    }

    await this.runRuntimeCommand(sessionId, tabId, shellState, 'node', words.slice(1).map(mapArgToNodebox))
  }

  setActiveSession(sessionId: string) {
    if (!this.workbench.sessions.some((session) => session.id === sessionId) || this.workbench.activeSessionId === sessionId) {
      return
    }

    this.setWorkbench({
      ...this.workbench,
      activeSessionId: sessionId,
    })
  }

  setActiveTerminalTab(tabId: string) {
    this.mutateActiveSession((session) => ({
      ...session,
      activeTerminalTabId: tabId,
    }))
  }

  setActiveInput(value: string) {
    const snapshot = this.getSnapshot()
    if (!snapshot.activeSession || !snapshot.activeTab) {
      return
    }

    this.mutateActiveSession((session) =>
      updateTab(session, snapshot.activeTab!.id, (tab) => ({
        ...tab,
        currentInput: value,
      })),
    )
  }

  navigateHistory(direction: 'up' | 'down') {
    const snapshot = this.getSnapshot()
    if (!snapshot.activeSession || !snapshot.activeTab) {
      return
    }

    const history = snapshot.activeTab.shellState.history
    if (history.length === 0) {
      return
    }

    this.mutateActiveSession((session) =>
      updateTab(session, snapshot.activeTab!.id, (tab) => {
        let nextCursor = tab.historyCursor
        let nextInput = tab.currentInput

        if (direction === 'up') {
          nextCursor = Math.min(tab.historyCursor + 1, history.length - 1)
          nextInput = history[history.length - 1 - nextCursor]
        } else if (tab.historyCursor <= 0) {
          nextCursor = -1
          nextInput = ''
        } else {
          nextCursor = tab.historyCursor - 1
          nextInput = history[history.length - 1 - nextCursor]
        }

        return {
          ...tab,
          historyCursor: nextCursor,
          currentInput: nextInput,
        }
      }),
    )
  }

  async interruptActiveTerminal() {
    const snapshot = this.getSnapshot()
    if (!snapshot.activeSession || !snapshot.activeTab) {
      return
    }

    if (snapshot.activeTab.process.status === 'running') {
      await this.nodebox?.stop(snapshot.activeTab.id)
      this.mutateActiveSession((session) =>
        updateTab(session, snapshot.activeTab!.id, (tab) => ({
          ...tab,
          process: {
            status: 'idle',
            lastCommand: tab.process.lastCommand,
            lastExitCode: 130,
          },
          transcript: appendTranscript(tab.transcript, [createTranscriptLine('system', '^C')]),
        })),
      )
      return
    }

    this.setActiveInput('')
  }

  async executeCommand(tabId: string, rawCommand: string) {
    const session = activeSessionFrom(this.workbench)
    const tab = activeTabFrom(session)
    const bash = this.bash
    if (!session || !tab || !bash) {
      return
    }

    const command = rawCommand.trim()
    const nextShellState = createShellState({
      cwd: tab.shellState.cwd,
      env: tab.shellState.env,
      history: command ? [...tab.shellState.history, command].slice(-200) : tab.shellState.history,
    })

    this.mutateSession(session.id, (current) =>
      updateTab(current, tabId, (existingTab) => ({
        ...existingTab,
        shellState: nextShellState,
        title: formatTerminalTabTitle(nextShellState.cwd),
        currentInput: '',
        historyCursor: -1,
        transcript: command
          ? appendTranscript(existingTab.transcript, [createInputLine(existingTab.shellState, command)])
          : existingTab.transcript,
      })),
    )

    if (!command) {
      return
    }

    if (command === 'clear') {
      this.mutateSession(session.id, (current) =>
        updateTab(current, tabId, (existingTab) => ({
          ...existingTab,
          transcript: [],
        })),
      )
      return
    }

    if (command === 'stop') {
      await this.nodebox?.stop(tabId)
      this.mutateSession(session.id, (current) =>
        updateTab(current, tabId, (existingTab) => ({
          ...existingTab,
          process: {
            status: 'idle',
            lastCommand: existingTab.process.lastCommand,
            lastExitCode: 130,
          },
          transcript: appendTranscript(existingTab.transcript, [createTranscriptLine('system', 'Stopped active runtime process.')]),
        })),
      )
      return
    }

    if (/^npm\b/.test(command)) {
      await this.handleNpmCommand(session.id, tabId, nextShellState, command)
      return
    }

    if (/^node\b/.test(command)) {
      await this.handleNodeCommand(session.id, tabId, nextShellState, command)
      return
    }

    const previousWorkspace = session.workspace
    const result = await bash.exec(command, nextShellState)

    this.mutateSession(session.id, (current) =>
      updateTab(
        {
          ...current,
          workspace: cloneWorkspaceSnapshot(result.workspace),
        },
        tabId,
        (existingTab) => ({
          ...existingTab,
          shellState: result.shellState,
          title: formatTerminalTabTitle(result.shellState.cwd),
          transcript: appendTranscript(existingTab.transcript, [
            ...outputLines('stdout', result.stdout),
            ...outputLines('stderr', result.stderr),
          ]),
        }),
      ),
    )

    await this.syncNodebox(result.workspace, previousWorkspace)
  }

  createSession(name = sessionNameForIndex(this.workbench.sessions.length + 1)) {
    const session = createSessionSnapshot(name)
    this.setWorkbench({
      sessions: [...this.workbench.sessions, session],
      activeSessionId: session.id,
    })
    this.setStatusMessage(`Spawned ${session.name}`)
    return session
  }

  saveActiveSession() {
    const session = activeSessionFrom(this.workbench)
    if (!session) {
      return
    }

    const savedAt = nowIso()
    this.mutateSession(this.workbench.activeSessionId, (entry) => ({
      ...entry,
      lastSavedAt: savedAt,
      updatedAt: savedAt,
    }))
    this.setStatusMessage(`Stashed ${session.name}`)
  }

  exportActiveSessionArchive() {
    const session = activeSessionFrom(this.workbench)
    if (!session) {
      return null
    }

    const bytes = exportSessionArchive(session)
    this.setStatusMessage(`Pulled zip for ${session.name}`)
    return {
      bytes,
      fileName: fileNameForSessionArchive(session),
      session,
    }
  }

  async importSessionArchiveBuffer(buffer: ArrayBuffer) {
    const session = importSessionArchive(buffer)
    this.setWorkbench({
      sessions: [...this.workbench.sessions, session],
      activeSessionId: session.id,
    })
    this.setStatusMessage(`Loaded ${session.name}`)
    return session
  }

  renameSession(sessionId: string, name: string) {
    const nextName = name.trim()
    if (!nextName) {
      return
    }

    this.mutateSession(sessionId, (current) => ({
      ...current,
      name: nextName,
    }))
  }

  deleteSession(sessionId: string) {
    const session = this.workbench.sessions.find((entry) => entry.id === sessionId)
    if (!session) {
      return null
    }

    const remaining = this.workbench.sessions.filter((entry) => entry.id !== sessionId)
    if (remaining.length === 0) {
      const fallback = createSessionSnapshot('Session 1')
      this.setWorkbench({
        sessions: [fallback],
        activeSessionId: fallback.id,
      })
      return session
    }

    this.setWorkbench({
      sessions: remaining,
      activeSessionId: this.workbench.activeSessionId === sessionId ? remaining[0].id : this.workbench.activeSessionId,
    })
    return session
  }

  createTerminal() {
    const snapshot = this.getSnapshot()
    if (!snapshot.activeSession || !snapshot.activeTab) {
      return null
    }

    const tab = createTerminalTab({
      shellState: createShellState({
        cwd: snapshot.activeTab.shellState.cwd,
        env: snapshot.activeTab.shellState.env,
        history: snapshot.activeTab.shellState.history,
      }),
      transcript: [createTranscriptLine('system', `Opened from ${basename(snapshot.activeTab.shellState.cwd)}`)],
      title: `${formatTerminalTabTitle(snapshot.activeTab.shellState.cwd)}:${snapshot.activeSession.terminalTabs.length + 1}`,
    })

    this.mutateActiveSession((session) => ({
      ...session,
      terminalTabs: [...session.terminalTabs, tab],
      activeTerminalTabId: tab.id,
    }))

    return tab
  }

  async closeTerminal(tabId: string) {
    const session = activeSessionFrom(this.workbench)
    if (!session || session.terminalTabs.length === 1) {
      return
    }

    await this.nodebox?.stop(tabId)

    this.mutateActiveSession((entry) => {
      const tabs = entry.terminalTabs.filter((tab) => tab.id !== tabId)
      return {
        ...entry,
        terminalTabs: tabs,
        activeTerminalTabId: entry.activeTerminalTabId === tabId ? tabs[0].id : entry.activeTerminalTabId,
      }
    })
  }
}
