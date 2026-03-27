export const WORKSPACE_ROOT = '/workspace'
export const WORKBENCH_STORAGE_KEY = 'session-shell-workbench-v1'
export const LEGACY_WORKSPACE_STORAGE_KEY = 'browser-runtime-workspace-v1'
export const SESSION_ARCHIVE_METADATA = '__just_node_session.json'

export type WorkspaceSnapshot = {
  files: Record<string, string>
  directories: string[]
}

export type ShellState = {
  cwd: string
  env: Record<string, string>
  history: string[]
}

export type TranscriptKind = 'input' | 'stdout' | 'stderr' | 'system'

export type TranscriptLine = {
  id: string
  kind: TranscriptKind
  text: string
  at: string
}

export type TerminalProcessState = {
  status: 'idle' | 'running' | 'error'
  lastCommand: string
  lastExitCode: number | null
}

export type TerminalTabSnapshot = {
  id: string
  title: string
  shellState: ShellState
  transcript: TranscriptLine[]
  currentInput: string
  historyCursor: number
  process: TerminalProcessState
}

export type SessionSnapshot = {
  id: string
  name: string
  workspace: WorkspaceSnapshot
  terminalTabs: TerminalTabSnapshot[]
  activeTerminalTabId: string
  createdAt: string
  updatedAt: string
  lastSavedAt: string | null
}

export type WorkbenchState = {
  sessions: SessionSnapshot[]
  activeSessionId: string
}

type LegacyWorkspaceSnapshot = {
  files?: Record<string, string>
  directories?: string[]
  cwd?: string
  env?: Record<string, string>
  history?: string[]
}

function normalizeAbsolutePath(input: string): string {
  const raw = input.startsWith('/') ? input : `/${input}`
  const parts = raw.split('/').filter(Boolean)
  const normalized: string[] = []

  for (const part of parts) {
    if (part === '.') {
      continue
    }

    if (part === '..') {
      normalized.pop()
      continue
    }

    normalized.push(part)
  }

  return normalized.length === 0 ? '/' : `/${normalized.join('/')}`
}

export function nowIso() {
  return new Date().toISOString()
}

export function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function resolveFrom(base: string, input: string): string {
  if (!input) {
    return normalizeAbsolutePath(base)
  }

  if (input.startsWith('/')) {
    return normalizeAbsolutePath(input)
  }

  const prefix = base === '/' ? '' : base
  return normalizeAbsolutePath(`${prefix}/${input}`)
}

export function dirname(path: string): string {
  const normalized = normalizeAbsolutePath(path)
  if (normalized === '/') {
    return '/'
  }

  const parts = normalized.split('/').filter(Boolean)
  parts.pop()
  return parts.length === 0 ? '/' : `/${parts.join('/')}`
}

export function basename(path: string): string {
  const normalized = normalizeAbsolutePath(path)
  if (normalized === '/') {
    return '/'
  }

  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? normalized
}

export function isWorkspacePath(path: string): boolean {
  const normalized = normalizeAbsolutePath(path)
  return normalized === WORKSPACE_ROOT || normalized.startsWith(`${WORKSPACE_ROOT}/`)
}

export function isDerivedWorkspacePath(path: string): boolean {
  const normalized = normalizeAbsolutePath(path)
  return [
    `${WORKSPACE_ROOT}/node_modules`,
    `${WORKSPACE_ROOT}/.store`,
    `${WORKSPACE_ROOT}/.pnpm`,
    `${WORKSPACE_ROOT}/.runtime-inline`,
  ].some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))
}

export function ensureWorkspaceAbsolute(path: string): string {
  const normalized = normalizeAbsolutePath(path)
  if (isWorkspacePath(normalized)) {
    return normalized
  }

  if (normalized === '/') {
    return WORKSPACE_ROOT
  }

  return normalizeAbsolutePath(`${WORKSPACE_ROOT}/${normalized.replace(/^\/+/, '')}`)
}

export function workspaceToRelative(path: string): string {
  const normalized = ensureWorkspaceAbsolute(path)
  if (normalized === WORKSPACE_ROOT) {
    return '/'
  }

  return normalized.slice(WORKSPACE_ROOT.length)
}

export function workspaceToNodeboxPath(path: string): string {
  const relative = workspaceToRelative(path)
  return relative === '/' ? '/' : relative
}

export function nodeboxToWorkspacePath(path: string): string {
  const cleaned = path.replace(/^\.\//, '').replace(/^\//, '')
  return cleaned ? `${WORKSPACE_ROOT}/${cleaned}` : WORKSPACE_ROOT
}

export function toNodeboxFiles(snapshot: WorkspaceSnapshot): Record<string, string> {
  return Object.fromEntries(
    Object.entries(snapshot.files)
      .filter(([path]) => !isDerivedWorkspacePath(path))
      .map(([path, content]) => [workspaceToRelative(path).replace(/^\//, ''), content]),
  )
}

export function toNodeboxDirectories(snapshot: WorkspaceSnapshot): string[] {
  return snapshot.directories
    .filter((path) => !isDerivedWorkspacePath(path))
    .map((path) => workspaceToRelative(path))
    .filter((path) => path !== '/')
    .map((path) => path.replace(/^\//, ''))
}

export function sortWorkspacePaths(paths: string[]) {
  return [...paths].sort((left, right) => left.localeCompare(right))
}

export function createShellState(overrides?: Partial<ShellState>): ShellState {
  return {
    cwd: overrides?.cwd ?? WORKSPACE_ROOT,
    env: overrides?.env ?? {},
    history: overrides?.history ?? [],
  }
}

export function createTranscriptLine(kind: TranscriptKind, text: string): TranscriptLine {
  return {
    id: createId('line'),
    kind,
    text,
    at: nowIso(),
  }
}

export function appendTranscript(
  transcript: TranscriptLine[],
  next: TranscriptLine[],
  limit = 1000,
): TranscriptLine[] {
  return [...transcript, ...next].slice(-limit)
}

export function formatTerminalTabTitle(cwd: string) {
  const relative = workspaceToRelative(cwd)
  return relative === '/' ? '~/workspace' : `~${relative}`
}

export function createTerminalTab(overrides?: Partial<TerminalTabSnapshot>): TerminalTabSnapshot {
  const shellState = createShellState(overrides?.shellState)
  return {
    id: overrides?.id ?? createId('term'),
    title: overrides?.title ?? formatTerminalTabTitle(shellState.cwd),
    shellState,
    transcript: overrides?.transcript ?? [
      createTranscriptLine('system', 'Welcome to the browser terminal workbench.'),
      createTranscriptLine('system', 'Use just-bash commands, node, and npm run from here.'),
    ],
    currentInput: overrides?.currentInput ?? '',
    historyCursor: overrides?.historyCursor ?? -1,
    process: overrides?.process ?? {
      status: 'idle',
      lastCommand: '',
      lastExitCode: null,
    },
  }
}

export function createStarterWorkspace(): WorkspaceSnapshot {
  const packageJson = `${JSON.stringify(
    {
      name: 'browser-terminal-workspace',
      private: true,
      type: 'module',
      scripts: {
        dev: 'node server.js',
        start: 'node server.js',
      },
      dependencies: {},
      devDependencies: {},
    },
    null,
    2,
  )}\n`

  return {
    directories: [WORKSPACE_ROOT],
    files: {
      [`${WORKSPACE_ROOT}/README.md`]: [
        '# Browser Terminal Workbench',
        '',
        'This session gives you a real browser-backed shell workspace.',
        '',
        'Try:',
        '- `pwd`',
        '- `tree`',
        '- `cat README.md`',
        '- `echo hello > notes.txt`',
        '- `node -e "console.log(\'hey\')"`',
        '- `npm run dev`',
      ].join('\n'),
      [`${WORKSPACE_ROOT}/package.json`]: packageJson,
      [`${WORKSPACE_ROOT}/server.js`]: [
        "import { createServer } from 'node:http'",
        "import { readFile } from 'node:fs/promises'",
        "import { extname, join } from 'node:path'",
        '',
        'const port = Number(process.env.PORT || 3000)',
        'const root = process.cwd()',
        '',
        'const mimeTypes = {',
        "  '.html': 'text/html; charset=utf-8',",
        "  '.js': 'text/javascript; charset=utf-8',",
        "  '.css': 'text/css; charset=utf-8',",
        '}',
        '',
        'const server = createServer(async (request, response) => {',
        '  try {',
        '    const pathname = new URL(request.url || "/", "http://localhost").pathname',
        '    const target = pathname === "/" ? "index.html" : pathname.replace(/^[/]+/, "")',
        '    const filePath = join(root, target)',
        '    const body = await readFile(filePath)',
        '    const type = mimeTypes[extname(filePath)] || "text/plain; charset=utf-8"',
        '    response.writeHead(200, { "content-type": type })',
        '    response.end(body)',
        '  } catch (error) {',
        '    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" })',
        '    response.end(`Not found: ${String(error)}`)',
        '  }',
        '})',
        '',
        'server.listen(port, () => {',
        '  console.log(`preview server running on http://127.0.0.1:${port}`)',
        '})',
      ].join('\n'),
      [`${WORKSPACE_ROOT}/index.html`]: [
        '<!doctype html>',
        '<html lang="en">',
        '  <head>',
        '    <meta charset="UTF-8" />',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        '    <title>Browser Terminal Workbench</title>',
        '    <link rel="stylesheet" href="./styles.css" />',
        '  </head>',
        '  <body>',
        '    <main class="page">',
        '      <p class="eyebrow">Nodebox preview</p>',
        '      <h1>Hello from your browser workspace.</h1>',
        '      <p>Run <code>npm run dev</code> from a terminal tab to boot this preview.</p>',
        '      <script type="module" src="./client.js"></script>',
        '    </main>',
        '  </body>',
        '</html>',
      ].join('\n'),
      [`${WORKSPACE_ROOT}/styles.css`]: [
        'body {',
        '  margin: 0;',
        '  min-height: 100vh;',
        '  display: grid;',
        '  place-items: center;',
        '  background: #0b0d10;',
        '  color: #f1f4f8;',
        '  font: 16px/1.5 "Avenir Next", "Segoe UI", sans-serif;',
        '}',
        '.page { text-align: center; }',
        '.eyebrow { text-transform: uppercase; letter-spacing: 0.18em; color: #6db5ff; }',
        'h1 { font-size: clamp(2rem, 7vw, 4rem); }',
        'code { color: #6db5ff; }',
      ].join('\n'),
      [`${WORKSPACE_ROOT}/client.js`]: 'console.log("preview ready")\n',
    },
  }
}

export function cloneWorkspaceSnapshot(workspace: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    directories: [...workspace.directories],
    files: { ...workspace.files },
  }
}

export function createSessionSnapshot(name = 'New Session', workspace?: WorkspaceSnapshot): SessionSnapshot {
  const createdAt = nowIso()
  const terminal = createTerminalTab()
  return {
    id: createId('session'),
    name,
    workspace: cloneWorkspaceSnapshot(workspace ?? createStarterWorkspace()),
    terminalTabs: [terminal],
    activeTerminalTabId: terminal.id,
    createdAt,
    updatedAt: createdAt,
    lastSavedAt: createdAt,
  }
}

function sanitizeTerminalTab(tab: TerminalTabSnapshot): TerminalTabSnapshot {
  const shellState = createShellState(tab.shellState)
  return {
    ...tab,
    title: tab.title || formatTerminalTabTitle(shellState.cwd),
    shellState,
    transcript: tab.transcript ?? [],
    currentInput: tab.currentInput ?? '',
    historyCursor: tab.historyCursor ?? -1,
    process: tab.process ?? {
      status: 'idle',
      lastCommand: '',
      lastExitCode: null,
    },
  }
}

function sanitizeSession(session: SessionSnapshot): SessionSnapshot {
  const workspace = cloneWorkspaceSnapshot(session.workspace)
  const tabs = (session.terminalTabs.length > 0 ? session.terminalTabs : [createTerminalTab()]).map(sanitizeTerminalTab)
  const activeTerminalTabId = tabs.some((tab) => tab.id === session.activeTerminalTabId)
    ? session.activeTerminalTabId
    : tabs[0].id

  return {
    ...session,
    workspace,
    terminalTabs: tabs,
    activeTerminalTabId,
    lastSavedAt: session.lastSavedAt ?? null,
  }
}

function migrateLegacyWorkspace(legacy: LegacyWorkspaceSnapshot): WorkbenchState {
  const starter = createStarterWorkspace()
  const workspace: WorkspaceSnapshot = {
    files: legacy.files ?? starter.files,
    directories: legacy.directories ?? starter.directories,
  }

  const shellState = createShellState({
    cwd: legacy.cwd ?? WORKSPACE_ROOT,
    env: legacy.env ?? {},
    history: legacy.history ?? [],
  })

  const session = createSessionSnapshot('Migrated Session', workspace)
  session.terminalTabs = [
    createTerminalTab({
      shellState,
      transcript: [createTranscriptLine('system', 'Migrated from the previous browser workspace.')],
    }),
  ]
  session.activeTerminalTabId = session.terminalTabs[0].id

  return {
    sessions: [session],
    activeSessionId: session.id,
  }
}

export function loadWorkbenchState(): WorkbenchState {
  if (typeof window === 'undefined') {
    const session = createSessionSnapshot('Session 1')
    return { sessions: [session], activeSessionId: session.id }
  }

  try {
    const raw = window.localStorage.getItem(WORKBENCH_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as WorkbenchState
      const sessions = parsed.sessions.map(sanitizeSession)
      const activeSessionId = sessions.some((session) => session.id === parsed.activeSessionId)
        ? parsed.activeSessionId
        : sessions[0]?.id

      if (sessions.length > 0 && activeSessionId) {
        return {
          sessions,
          activeSessionId,
        }
      }
    }
  } catch {
    // ignore and fall through to migration/default bootstrap
  }

  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY)
    if (legacyRaw) {
      const migrated = migrateLegacyWorkspace(JSON.parse(legacyRaw) as LegacyWorkspaceSnapshot)
      saveWorkbenchState(migrated)
      return migrated
    }
  } catch {
    // ignore and fall through to default bootstrap
  }

  const session = createSessionSnapshot('Session 1')
  return { sessions: [session], activeSessionId: session.id }
}

export function saveWorkbenchState(state: WorkbenchState) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(state))
}

export function formatSessionTimestamp(value: string | null) {
  if (!value) {
    return 'Never saved'
  }

  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function updateSessionMetadata(session: SessionSnapshot, updates?: Partial<Pick<SessionSnapshot, 'lastSavedAt'>>) {
  return {
    ...session,
    updatedAt: nowIso(),
    lastSavedAt: updates?.lastSavedAt ?? session.lastSavedAt,
  }
}

export function sameWorkspace(left: WorkspaceSnapshot, right: WorkspaceSnapshot) {
  const leftFiles = Object.keys(left.files)
  const rightFiles = Object.keys(right.files)

  if (leftFiles.length !== rightFiles.length || left.directories.length !== right.directories.length) {
    return false
  }

  for (const path of leftFiles) {
    if (left.files[path] !== right.files[path]) {
      return false
    }
  }

  for (let index = 0; index < left.directories.length; index += 1) {
    if (left.directories[index] !== right.directories[index]) {
      return false
    }
  }

  return true
}
