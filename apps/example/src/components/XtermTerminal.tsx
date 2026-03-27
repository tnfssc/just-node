import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { type TerminalTabSnapshot, type TranscriptLine } from '@just-node/core'

type XtermTerminalProps = {
  tab: TerminalTabSnapshot
  onInputChange: (value: string) => void
  onSubmit: (command: string) => void
  onHistory: (direction: 'up' | 'down') => void
  onInterrupt: () => void
}

function promptFor(tab: TerminalTabSnapshot) {
  return `${tab.shellState.cwd} $ `
}

function colorize(line: TranscriptLine) {
  const prefix = (() => {
    switch (line.kind) {
      case 'stderr':
        return '\u001b[38;5;203m'
      case 'system':
        return '\u001b[38;5;245m'
      case 'input':
        return '\u001b[38;5;81m'
      default:
        return '\u001b[38;5;255m'
    }
  })()

  return `${prefix}${line.text || ' '}\u001b[0m`
}

export function XtermTerminal({
  tab,
  onInputChange,
  onSubmit,
  onHistory,
  onInterrupt,
}: XtermTerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const lastTabIdRef = useRef<string | null>(null)
  const lastTranscriptSizeRef = useRef(0)
  const tabRef = useRef(tab)
  const onInputChangeRef = useRef(onInputChange)
  const onSubmitRef = useRef(onSubmit)
  const onHistoryRef = useRef(onHistory)
  const onInterruptRef = useRef(onInterrupt)

  useEffect(() => {
    tabRef.current = tab
    onInputChangeRef.current = onInputChange
    onSubmitRef.current = onSubmit
    onHistoryRef.current = onHistory
    onInterruptRef.current = onInterrupt
  }, [tab, onHistory, onInputChange, onInterrupt, onSubmit])

  useEffect(() => {
    if (!hostRef.current) {
      return
    }

    const initialTab = tabRef.current
    const replay = (terminal: Terminal, nextTab: TerminalTabSnapshot) => {
      terminal.clear()
      for (const entry of nextTab.transcript) {
        terminal.writeln(colorize(entry))
      }
      terminal.write(`${promptFor(nextTab)}${nextTab.currentInput}`)
      lastTranscriptSizeRef.current = nextTab.transcript.length
    }

    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'SFMono-Regular, Consolas, monospace',
      fontSize: 16,
      lineHeight: 1.3,
      theme: {
        background: '#05070a',
        foreground: '#e6edf3',
        cursor: '#8fb7ff',
      },
    })
    terminal.open(hostRef.current)
    const textInput = hostRef.current.querySelector('textarea')
    if (textInput) {
      textInput.id = 'xterm-input'
      textInput.setAttribute('name', 'terminal-input')
    }
    terminal.focus()

    const disposable = terminal.onData((data) => {
      if (data === '\u0003') {
        onInterruptRef.current()
        return
      }

      if (data === '\r') {
        onSubmitRef.current(tabRef.current.currentInput)
        return
      }

      if (data === '\u007f') {
        onInputChangeRef.current(tabRef.current.currentInput.slice(0, -1))
        return
      }

      if (data === '\u001b[A') {
        onHistoryRef.current('up')
        return
      }

      if (data === '\u001b[B') {
        onHistoryRef.current('down')
        return
      }

      if (data >= ' ' && data !== '\u007f') {
        onInputChangeRef.current(`${tabRef.current.currentInput}${data}`)
      }
    })

    terminalRef.current = terminal
    replay(terminal, initialTab)
    lastTabIdRef.current = initialTab.id

    return () => {
      disposable.dispose()
      terminal.dispose()
      terminalRef.current = null
    }
  }, [])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) {
      return
    }

    const redrawPrompt = () => {
      terminal.write(`\r\u001b[2K${promptFor(tab)}${tab.currentInput}`)
    }

    const replay = () => {
      terminal.clear()
      for (const entry of tab.transcript) {
        terminal.writeln(colorize(entry))
      }
      terminal.write(`${promptFor(tab)}${tab.currentInput}`)
      lastTranscriptSizeRef.current = tab.transcript.length
    }

    if (lastTabIdRef.current !== tab.id) {
      replay()
      lastTabIdRef.current = tab.id
      terminal.focus()
      return
    }

    if (lastTranscriptSizeRef.current !== tab.transcript.length) {
      replay()
      terminal.focus()
      return
    }

    redrawPrompt()
  }, [tab])

  return (
    <div
      ref={hostRef}
      className="min-h-[60vh] w-full overflow-hidden border border-[var(--line-strong)] bg-[linear-gradient(180deg,rgba(173,191,136,0.025),transparent_20%),#050706] md:min-h-[calc(100vh-8.2rem)]"
    />
  )
}
