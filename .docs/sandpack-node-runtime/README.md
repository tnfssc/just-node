# Sandpack Node Runtime

This folder collects the most relevant public source and documentation I found for Sandpack's Node runtime.

Official project lineage:

- Sandpack docs: `https://sandpack.codesandbox.io/`
- Sandpack repo: `https://github.com/codesandbox/sandpack`
- Node runtime repo: `https://github.com/Sandpack/nodebox-runtime`
- Legacy repo URL still referenced in some docs: `https://github.com/codesandbox/nodebox-runtime`
- npm package: `@codesandbox/nodebox`

## What it is

Sandpack's Node runtime is `Nodebox`, a Node.js-compatible runtime designed to run in the browser. It is the runtime layer that lets Sandpack execute server-side or Node-oriented projects inside browser-based sandboxes.

## Repo split

The runtime implementation is not in the main `codesandbox/sandpack` repo.

- `codesandbox/sandpack` is the main Sandpack toolkit repo
- `Sandpack/nodebox-runtime` is the runtime implementation repo
- the package exposed from that repo is `@codesandbox/nodebox`

## What I pulled locally

- `./upstream/` - shallow clone of the official `nodebox-runtime` repo
- `./sources/README.md` - upstream runtime README
- `./sources/api.md` - upstream Nodebox API docs
- `./sources/Nodebox.ts` - main runtime client entrypoint
- `./sources/messages.ts` - runtime message definitions
- `./sources/runtime-protocol.types.ts` - protocol types
- `./sources/modules/` - filesystem, shell, and preview APIs
- `./sources/internals/` - internal server and build-plugin code
- `./external/` - related Sandpack announcement and docs context

## Start here

1. `./sources/README.md`
2. `./sources/api.md`
3. `./sources/Nodebox.ts`
4. `./sources/modules/fs.ts`
5. `./sources/modules/shell.ts`
6. `./sources/modules/preview.ts`
7. `./external/announcing-sandpack-2-node-runtime.md`

## Key naming caveat

If you want the Sandpack Node runtime specifically, use `nodebox-runtime`, not just the main Sandpack repo. The Sandpack repo documents and consumes the runtime, but the runtime implementation lives in its own repository.
