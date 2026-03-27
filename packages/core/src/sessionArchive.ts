import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import {
  SESSION_ARCHIVE_METADATA,
  WORKSPACE_ROOT,
  cloneWorkspaceSnapshot,
  createId,
  nowIso,
  workspaceToRelative,
  type SessionSnapshot,
  type TerminalTabSnapshot,
  type WorkspaceSnapshot,
} from './workspace'

type SessionArchiveMetadata = {
  version: 1
  name: string
  createdAt: string
  updatedAt: string
  activeTerminalTabId: string
  terminalTabs: Array<{
    id: string
    title: string
    shellState: TerminalTabSnapshot['shellState']
    transcript: TerminalTabSnapshot['transcript']
    currentInput: string
    historyCursor: number
    process: TerminalTabSnapshot['process']
  }>
  directories: string[]
}

export function fileNameForSessionArchive(session: SessionSnapshot) {
  return `${session.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'session'}.just-node.zip`
}

export function exportSessionArchive(session: SessionSnapshot): Uint8Array {
  const archive: Record<string, Uint8Array> = {}

  const metadata: SessionArchiveMetadata = {
    version: 1,
    name: session.name,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    activeTerminalTabId: session.activeTerminalTabId,
    terminalTabs: session.terminalTabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      shellState: tab.shellState,
      transcript: tab.transcript,
      currentInput: tab.currentInput,
      historyCursor: tab.historyCursor,
      process: {
        ...tab.process,
        status: 'idle',
      },
    })),
    directories: session.workspace.directories
      .map((path) => workspaceToRelative(path))
      .filter((path) => path !== '/'),
  }

  archive[SESSION_ARCHIVE_METADATA] = strToU8(JSON.stringify(metadata, null, 2))

  for (const [path, content] of Object.entries(session.workspace.files)) {
    archive[`workspace${workspaceToRelative(path)}`] = strToU8(content)
  }

  return zipSync(archive, { level: 6 })
}

export function importSessionArchive(buffer: ArrayBuffer): SessionSnapshot {
  const archive = unzipSync(new Uint8Array(buffer))
  const metadataEntry = archive[SESSION_ARCHIVE_METADATA]

  if (!metadataEntry) {
    throw new Error('Missing session archive metadata.')
  }

  const metadata = JSON.parse(strFromU8(metadataEntry)) as SessionArchiveMetadata
  if (metadata.version !== 1) {
    throw new Error(`Unsupported session archive version: ${metadata.version}`)
  }

  const files: Record<string, string> = {}
  for (const [path, content] of Object.entries(archive)) {
    if (!path.startsWith('workspace/')) {
      continue
    }

    const relative = path.slice('workspace'.length)
    const workspacePath = relative === '/' ? WORKSPACE_ROOT : `${WORKSPACE_ROOT}${relative}`
    files[workspacePath] = strFromU8(content)
  }

  const workspace: WorkspaceSnapshot = {
    files,
    directories: [
      WORKSPACE_ROOT,
      ...metadata.directories.map((path) => `${WORKSPACE_ROOT}${path.startsWith('/') ? path : `/${path}`}`),
    ],
  }

  const createdAt = nowIso()
  const tabs = metadata.terminalTabs.map((tab) => ({
    originalId: tab.id,
    ...tab,
    id: createId('term'),
    process: {
      ...tab.process,
      status: 'idle' as const,
      lastExitCode: null,
    },
  }))

  const terminalTabs = tabs.map((tab) => {
    const { originalId, ...rest } = tab
    void originalId
    return rest
  })

  const session: SessionSnapshot = {
    id: createId('session'),
    name: `${metadata.name} Imported`,
    workspace: cloneWorkspaceSnapshot(workspace),
    terminalTabs,
    activeTerminalTabId: tabs[0]?.id ?? createId('term'),
    createdAt,
    updatedAt: createdAt,
    lastSavedAt: createdAt,
  }

  const activeTab = tabs.find((tab) => tab.originalId === metadata.activeTerminalTabId)
  if (activeTab) {
    session.activeTerminalTabId = activeTab.id
  }

  return session
}
