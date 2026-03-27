import {
  WORKSPACE_ROOT,
  createTranscriptLine,
  workspaceToRelative,
  type ShellState,
  type TranscriptKind,
} from './workspace'

export function splitOutput(text: string): string[] {
  if (!text) {
    return []
  }

  const normalized = text.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n')
  if (parts[parts.length - 1] === '') {
    parts.pop()
  }

  return parts.length > 0 ? parts : ['']
}

export function splitShellWords(command: string): string[] {
  const words: string[] = []
  let current = ''
  let quote: 'single' | 'double' | null = null
  let escaping = false

  for (const character of command.trim()) {
    if (escaping) {
      current += character
      escaping = false
      continue
    }

    if (character === '\\' && quote !== 'single') {
      escaping = true
      continue
    }

    if (character === "'" && quote !== 'double') {
      quote = quote === 'single' ? null : 'single'
      continue
    }

    if (character === '"' && quote !== 'single') {
      quote = quote === 'double' ? null : 'double'
      continue
    }

    if (character === ' ' && !quote) {
      if (current) {
        words.push(current)
        current = ''
      }
      continue
    }

    current += character
  }

  if (current) {
    words.push(current)
  }

  return words
}

export function mapArgToNodebox(path: string) {
  if (path.startsWith(`${WORKSPACE_ROOT}/`) || path === WORKSPACE_ROOT) {
    const relative = workspaceToRelative(path)
    if (relative === '/') {
      return '.'
    }

    const normalized = relative.replace(/^\//, '')
    return normalized.includes('/') ? `./${normalized}` : normalized
  }

  return path
}

export function parsePackageScript(command: string) {
  const words = splitShellWords(command)
  const env: Record<string, string> = {}
  let runtimeCommand = ''
  const args: string[] = []

  for (const word of words) {
    if (!runtimeCommand && /^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) {
      const separator = word.indexOf('=')
      env[word.slice(0, separator)] = word.slice(separator + 1)
      continue
    }

    if (!runtimeCommand) {
      runtimeCommand = word
      continue
    }

    args.push(word)
  }

  return { command: runtimeCommand, args, env }
}

export type DependencySpec = {
  name: string
  version: string
}

export function parseDependencySpec(input: string): DependencySpec | null {
  const value = input.trim()
  if (!value || value.startsWith('-')) {
    return null
  }

  const separator = value.lastIndexOf('@')
  if (separator <= 0) {
    return {
      name: value,
      version: 'latest',
    }
  }

  return {
    name: value.slice(0, separator),
    version: value.slice(separator + 1) || 'latest',
  }
}

export function createInputLine(shellState: ShellState, command: string) {
  return createTranscriptLine('input', `${shellState.cwd} $ ${command}`)
}

export function outputLines(kind: TranscriptKind, text: string) {
  return splitOutput(text).map((entry) => createTranscriptLine(kind, entry))
}
