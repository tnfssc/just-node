import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TerminalWorkbenchController,
  formatSessionTimestamp,
  type TerminalWorkbenchSnapshot,
} from '@just-node/core'
import { XtermTerminal } from './components/XtermTerminal'

function downloadBytes(fileName: string, bytes: Uint8Array) {
  const blob = new Blob([Uint8Array.from(bytes)], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function App() {
  const controller = useMemo(() => new TerminalWorkbenchController(), [])
  const [snapshot, setSnapshot] = useState<TerminalWorkbenchSnapshot>(() => controller.getSnapshot())
  const [bridgeFrame, setBridgeFrame] = useState<HTMLIFrameElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => controller.subscribe(setSnapshot), [controller])

  useEffect(() => {
    void controller.attachBridgeFrame(bridgeFrame)
  }, [bridgeFrame, controller])

  useEffect(() => {
    return () => {
      void controller.dispose()
    }
  }, [controller])

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }

    Object.assign(window as Window & { __workbench?: unknown; __workbenchDebug?: unknown }, {
      __workbench: snapshot.workbench,
      __workbenchDebug: {
        getState: () => controller.getSnapshot(),
        exportActiveSessionBytes: () => {
          const archive = controller.exportActiveSessionArchive()
          return archive ? Array.from(archive.bytes) : null
        },
        importSessionBytes: async (bytes: number[]) => controller.importSessionArchiveBuffer(Uint8Array.from(bytes).buffer),
      },
    })
  }, [controller, snapshot.workbench])

  const { activeSession, activeTab, runtimeReady, statusMessage, workbench } = snapshot

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[var(--bg)] md:grid-cols-[minmax(15rem,17rem)_minmax(0,1fr)]">
      <iframe
        key={activeSession?.id}
        ref={setBridgeFrame}
        className="pointer-events-none absolute -left-[9999px] -top-[9999px] h-px w-px opacity-0"
        title="Nodebox bridge"
      />
      <input
        ref={importInputRef}
        className="hidden"
        type="file"
        accept=".zip,.just-node.zip"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void file.arrayBuffer().then((buffer) => controller.importSessionArchiveBuffer(buffer))
          }
          event.target.value = ''
        }}
      />

      <aside className="sticky top-0 z-20 grid gap-4 border-b border-[var(--line-strong)] bg-[rgba(10,13,11,0.985)] p-4 backdrop-blur md:static md:grid-rows-[auto_auto_minmax(0,1fr)] md:border-b-0 md:border-r md:backdrop-blur-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="border border-[var(--line-soft)] px-2.5 py-2 font-mono text-sm font-bold tracking-[0.06em] text-[var(--accent-strong)]">:&gt;</div>
            <div>
              <h1 className="text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--ink-bright)] md:text-[1.7rem]">just-node</h1>
              <p className="text-xs text-[var(--muted-soft)]">example app on top of core</p>
            </div>
          </div>
          <div className="border border-[var(--line-soft)] px-2 py-1 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-[var(--accent-strong)] md:hidden">
            {runtimeReady ? 'hot' : 'boot'}
          </div>
        </div>

        <div className="grid gap-2">
          <button
            className="w-full border border-[color:color-mix(in_srgb,var(--accent-strong)_56%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_20%,transparent)] px-4 py-3 text-left font-semibold text-[var(--ink-bright)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--accent)_28%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/45"
            onClick={() => controller.createSession()}
          >
            Spawn session
          </button>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <button className="bg-transparent py-1 text-[var(--muted-soft)] transition hover:text-[var(--ink-bright)]" onClick={() => controller.saveActiveSession()}>stash</button>
            <button
              className="bg-transparent py-1 text-[var(--muted-soft)] transition hover:text-[var(--ink-bright)]"
              onClick={() => {
                const archive = controller.exportActiveSessionArchive()
                if (archive) {
                  downloadBytes(archive.fileName, archive.bytes)
                }
              }}
            >
              pull zip
            </button>
            <button className="bg-transparent py-1 text-[var(--muted-soft)] transition hover:text-[var(--ink-bright)]" onClick={() => importInputRef.current?.click()}>load zip</button>
          </div>
        </div>

        <div className="grid auto-cols-[minmax(14rem,78vw)] grid-flow-col overflow-auto border-t border-[var(--line-soft)] md:grid-flow-row md:auto-cols-auto md:content-start">
          {workbench.sessions.map((session) => (
            <div
              key={session.id}
              className={`group relative grid grid-cols-[2px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--line-soft)] pl-0 ${
                session.id === workbench.activeSessionId ? 'bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)]' : 'bg-transparent'
              }`}
            >
              <div className={`self-stretch ${session.id === workbench.activeSessionId ? 'bg-[var(--accent)]' : 'bg-transparent'}`} />
              <button
                className="grid w-full gap-1 py-3 pr-1 text-left"
                onClick={() => controller.setActiveSession(session.id)}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <strong className="truncate text-[0.97rem] font-semibold text-[var(--ink-bright)]">{session.name}</strong>
                  <small className="shrink-0 text-[0.73rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">{session.terminalTabs.length} tty</small>
                </div>
                {session.id === workbench.activeSessionId ? (
                  <span className="text-[0.78rem] text-[var(--muted)]">stashed {formatSessionTimestamp(session.lastSavedAt)}</span>
                ) : null}
              </button>
              <div className={`flex items-center gap-1 pr-2 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${session.id === workbench.activeSessionId ? 'opacity-100' : 'pointer-events-none opacity-0 md:pointer-events-auto'}`}>
                <button
                  className="border border-transparent bg-transparent px-2 py-1 font-mono text-[0.73rem] font-semibold lowercase tracking-[0.06em] text-[var(--muted)] transition hover:border-[var(--line-strong)] hover:bg-white/5 hover:text-[var(--ink-bright)]"
                  onClick={() => {
                    const nextName = window.prompt('Session name', session.name)
                    if (nextName?.trim()) {
                      controller.renameSession(session.id, nextName)
                    }
                  }}
                >
                  mv
                </button>
                <button
                  className="border border-transparent bg-transparent px-2 py-1 font-mono text-[0.73rem] font-semibold lowercase tracking-[0.06em] text-[var(--danger)] transition hover:border-[var(--line-strong)] hover:bg-white/5"
                  onClick={() => {
                    if (window.confirm(`Delete ${session.name}?`)) {
                      controller.deleteSession(session.id)
                    }
                  }}
                >
                  drop
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="grid min-w-0 grid-rows-[auto_auto_minmax(0,1fr)]">
        <header className="flex flex-col items-start gap-2 border-b border-[var(--line-strong)] px-4 pb-3 pt-4 md:px-5">
          <h2 className="text-[1.1rem] font-semibold tracking-[-0.03em] text-[var(--ink-bright)] md:text-[1.35rem]">{activeSession?.name}</h2>
          <div className="flex min-h-6 items-center gap-2 font-mono text-[0.78rem] text-[var(--muted)]">
            <span className="text-[var(--accent-strong)]">{runtimeReady ? 'hot' : 'booting'}</span>
            {activeTab?.process.lastCommand ? <span>{activeTab.process.lastCommand}</span> : null}
            {!activeTab?.process.lastCommand ? <span>{statusMessage}</span> : null}
          </div>
        </header>

        <div className="flex items-center gap-1 overflow-auto px-4 pt-3 md:px-4">
          {activeSession?.terminalTabs.map((tab) => (
            <div key={tab.id} className={`flex min-w-0 items-stretch border border-b-0 border-[var(--line-soft)] ${tab.id === activeSession.activeTerminalTabId ? 'border-[color:color-mix(in_srgb,var(--accent)_44%,var(--line-soft))] bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)]' : 'bg-white/[0.02]'}`}>
              <button className="flex min-w-0 items-center gap-2 bg-transparent px-3 py-2 font-mono text-[0.83rem] text-[var(--muted)] transition hover:text-[var(--ink-bright)]" onClick={() => controller.setActiveTerminalTab(tab.id)}>
                <span className={`h-1.5 w-1.5 rounded-full ${tab.process.status === 'running' ? 'bg-[var(--success)]' : tab.process.status === 'error' ? 'bg-[var(--danger)]' : 'bg-[var(--accent)]'}`} />
                <span>{tab.title}</span>
              </button>
              <button className="border-l border-[var(--line-soft)] bg-transparent px-3 font-mono text-[0.82rem] text-[var(--muted)] transition hover:text-[var(--ink-bright)] disabled:opacity-30" onClick={() => void controller.closeTerminal(tab.id)} disabled={activeSession.terminalTabs.length === 1}>
                ×
              </button>
            </div>
          ))}
          <button className="self-stretch border border-[var(--line-soft)] bg-transparent px-3 font-mono text-[0.82rem] lowercase text-[var(--muted-soft)] transition hover:border-[var(--line-strong)] hover:bg-white/5 hover:text-[var(--ink-bright)]" onClick={() => controller.createTerminal()}>+ tty</button>
        </div>

        <section className="min-h-0 px-4 pb-4 md:px-4 md:pb-4">
          {activeTab ? (
            <XtermTerminal
              tab={activeTab}
              onInputChange={(value) => controller.setActiveInput(value)}
              onSubmit={(command) => void controller.executeCommand(activeTab.id, command)}
              onHistory={(direction) => controller.navigateHistory(direction)}
              onInterrupt={() => void controller.interruptActiveTerminal()}
            />
          ) : null}
        </section>
      </main>
    </div>
  )
}

export default App
