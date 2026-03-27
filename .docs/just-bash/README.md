# Vercel just-bash

This folder collects the most relevant public documentation I found for Vercel Labs' `just-bash` project.

Official project:

- Repo: `https://github.com/vercel-labs/just-bash`
- Site: `https://justbash.dev/`
- npm: `https://www.npmjs.com/package/just-bash`

## What it is

`just-bash` is a TypeScript implementation of a bash-like shell designed for AI agents and sandboxed automation. It runs bash syntax and Unix-style commands against a virtual filesystem, without spawning a real shell process for normal execution.

## How it works

From the official docs and architecture notes, the core flow is:

`Input Script -> Parser -> AST -> Interpreter -> ExecResult`

Key behaviors:

- `new Bash()` creates a shell environment with commands, env vars, cwd, execution limits, and filesystem bindings.
- `bash.exec(script)` parses the script, optionally applies AST transform plugins, and executes it through the interpreter.
- Each `exec()` call gets isolated shell state: env vars, functions, and cwd reset between calls.
- The filesystem persists across calls, so files created in one `exec()` are visible in the next.
- Commands are built in as TypeScript implementations rather than external binaries.

## Main capabilities

- Virtual filesystem with `InMemoryFs`
- Real-directory overlay reads with `OverlayFs`
- Real read/write filesystem with `ReadWriteFs`
- Mountable multi-filesystem setups with `MountableFs`
- Built-in Unix-style commands like `grep`, `sed`, `awk`, `jq`, `find`, `sort`, `xargs`, `sqlite3`, `yq`
- Optional network access through allow-listed `curl`
- Optional JavaScript via QuickJS WASM (`js-exec`)
- Optional Python via CPython WASM (`python3`)
- AST transform plugins for instrumentation and metadata extraction
- `Sandbox` API compatible with `@vercel/sandbox` usage patterns

## Security model

Important caveats from the docs:

- No network access by default
- No real filesystem access by default
- Python and JavaScript are opt-in because they widen the attack surface
- Execution limits protect against runaway loops/recursion/output growth
- It is not a full VM isolation boundary; Vercel recommends `@vercel/sandbox` when you need arbitrary binary execution or stronger isolation

## What to read first

1. `./sources/README.md` - primary product docs and API overview
2. `./sources/AGENTS.md` - concise guidance for agent use cases
3. `./sources/CLAUDE.md` - repo architecture notes and development guidance
4. `./sources/AST_TRANSFORMS.md` - transform plugin system
5. `./sources/KNOWN_LIMITATIONS.md` - bash compatibility gaps and agent-relevant limitations
6. `./external/vercel-changelog-bash-tool.md` - related tool built on top of `just-bash`
7. `./external/vercel-blog-testing-bash-is-all-you-need.md` - evaluation context and real-world usage discussion

## Naming / repo ambiguity

- This project is `vercel-labs/just-bash`
- It is different from older Vercel bash runtimes such as `vercel-community/bash`
- `bash-tool` is a related project that wraps `just-bash` for AI SDK agents; it is not the same repo

## Local file map

- `./SOURCES.md` - source URLs and why each file matters
- `./sources/` - official project docs copied locally
- `./external/` - related Vercel blog/changelog context
