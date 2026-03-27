# Sources

## Official URLs

- Sandpack docs: `https://sandpack.codesandbox.io/`
- Sandpack repo: `https://github.com/codesandbox/sandpack`
- Node runtime repo: `https://github.com/Sandpack/nodebox-runtime`
- Legacy node runtime URL: `https://github.com/codesandbox/nodebox-runtime`
- Nodebox package: `https://www.npmjs.com/package/@codesandbox/nodebox`

## Pulled locally from the runtime repo

- `./sources/README.md`
  - Source: `upstream/README.md`
  - Why: high-level overview, install, usage, and architecture entrypoint

- `./sources/api.md`
  - Source: `upstream/packages/nodebox/api.md`
  - Why: main public Nodebox API documentation

- `./sources/package.json`
  - Source: `upstream/package.json`
  - Why: monorepo scripts, package layout, workspace metadata

- `./sources/nodebox.package.json`
  - Source: `upstream/packages/nodebox/package.json`
  - Why: published package surface for `@codesandbox/nodebox`

- `./sources/index.ts`
  - Source: `upstream/packages/nodebox/src/index.ts`
  - Why: runtime package public exports

- `./sources/Nodebox.ts`
  - Source: `upstream/packages/nodebox/src/Nodebox.ts`
  - Why: primary runtime class and connection lifecycle

- `./sources/messages.ts`
  - Source: `upstream/packages/nodebox/src/messages.ts`
  - Why: message and bridge definitions used by the runtime

- `./sources/runtime-protocol.types.ts`
  - Source: `upstream/packages/nodebox/src/runtime-protocol.types.ts`
  - Why: protocol contract types

- `./sources/modules/fs.ts`
  - Source: `upstream/packages/nodebox/src/modules/fs.ts`
  - Why: filesystem API wrapper

- `./sources/modules/shell.ts`
  - Source: `upstream/packages/nodebox/src/modules/shell.ts`
  - Why: shell/command execution interface

- `./sources/modules/preview.ts`
  - Source: `upstream/packages/nodebox/src/modules/preview.ts`
  - Why: preview URL and shell-to-preview mapping

- `./sources/internals/servers/`
  - Source: `upstream/internals/servers/`
  - Why: supporting servers for runtime/preview flows

- `./sources/internals/esbuild-plugins/`
  - Source: `upstream/internals/esbuild-plugins/`
  - Why: build/runtime integration details

## Related context files

- `./external/announcing-sandpack-2-node-runtime.md`
  - Source: `https://codesandbox.io/blog/announcing-sandpack-2`
  - Why: official announcement explaining what Nodebox is and how it differs from the older browser-only setup

- `./external/sandpack-docs-introduction.md`
  - Source: `https://sandpack.codesandbox.io/docs`
  - Why: official Sandpack docs positioning and ecosystem context
