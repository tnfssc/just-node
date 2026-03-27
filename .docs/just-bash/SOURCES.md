# Sources

## Official project

- Repo: `https://github.com/vercel-labs/just-bash`
- Site: `https://justbash.dev/`
- npm: `https://www.npmjs.com/package/just-bash`

## Pulled locally

- `./sources/README.md`
  - Source: `https://raw.githubusercontent.com/vercel-labs/just-bash/main/README.md`
  - Why: Primary docs covering install, API, CLI, filesystems, security, browser support

- `./sources/AGENTS.md`
  - Source: `https://raw.githubusercontent.com/vercel-labs/just-bash/main/AGENTS.npm.md`
  - Why: Condensed instructions for agent builders using `just-bash`

- `./sources/CLAUDE.md`
  - Source: `https://raw.githubusercontent.com/vercel-labs/just-bash/main/CLAUDE.md`
  - Why: Best high-level architecture map in the repo

- `./sources/AST_TRANSFORMS.md`
  - Source: `https://raw.githubusercontent.com/vercel-labs/just-bash/main/src/transform/README.md`
  - Why: Explains AST transform pipeline and built-in plugins

- `./sources/KNOWN_LIMITATIONS.md`
  - Source: `https://raw.githubusercontent.com/vercel-labs/just-bash/main/src/spec-tests/bash/KNOWN_LIMITATIONS.md`
  - Why: Lists current bash compatibility gaps and agent-priority features

- `./sources/package.json`
  - Source: `https://raw.githubusercontent.com/vercel-labs/just-bash/main/package.json`
  - Why: Shows published binaries, exports, scripts, dependencies, and package surface

- `./external/vercel-changelog-bash-tool.md`
  - Source: `https://vercel.com/changelog/introducing-bash-tool-for-filesystem-based-context-retrieval`
  - Why: Explains the related `bash-tool` wrapper and how `just-bash` is used by Vercel agents

- `./external/vercel-blog-testing-bash-is-all-you-need.md`
  - Source: `https://vercel.com/blog/testing-if-bash-is-all-you-need`
  - Why: Gives eval context, performance lessons, and how `just-bash` fits into hybrid agent workflows

## Key source files worth inspecting in the upstream repo

I did not copy full source snapshots here because the public docs already explain most of the architecture, but these are the most relevant implementation entrypoints:

- `src/Bash.ts` - shell environment, `exec()`, transform integration, limits, feature enablement
- `src/sandbox/Sandbox.ts` - `Sandbox.create()`, command execution wrapper, Vercel Sandbox compatibility
- `src/browser.ts` - browser-safe export surface and exclusions
