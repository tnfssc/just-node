# Integration Notes

## What each project is good at

### just-bash

Best for:

- terminal-like file inspection and mutation
- `grep`, `rg`, `sed`, `awk`, `find`, `cat`, `touch`, `mkdir`, `cp`, `mv`, `rm`
- shell syntax like pipes, redirects, globs, chaining

Important behavior:

- browser entrypoint exports `Bash`, `InMemoryFs`, and FS types, but excludes Node-only pieces like `OverlayFs`, `ReadWriteFs`, `Sandbox`, Python, SQLite, and JS execution (`.docs/just-bash/upstream/src/browser.ts:2`)
- a single `Bash` instance keeps one filesystem alive across calls, but each `exec()` resets shell state like cwd/env/functions (`.docs/just-bash/upstream/src/Bash.ts:286`, `.docs/just-bash/upstream/src/Bash.ts:556`)
- the FS interface is explicitly designed to allow custom backends, including browser IndexedDB-style storage (`.docs/just-bash/upstream/src/fs/interface.ts:110`)

### Nodebox

Best for:

- running Node-compatible code in-browser
- booting dev servers and app previews
- reacting to file writes while the runtime is alive

Important behavior:

- `Nodebox` mounts a runtime URL into an iframe and talks to it over a message channel (`.docs/sandpack-node-runtime/upstream/packages/nodebox/src/Nodebox.ts:13`, `.docs/sandpack-node-runtime/upstream/packages/nodebox/src/Nodebox.ts:59`)
- runtime FS supports `init`, `readFile`, `writeFile`, `mkdir`, `readdir`, `stat`, `rm`, and `watch` (`.docs/sandpack-node-runtime/upstream/packages/nodebox/src/modules/fs.ts:30`)
- commands run through `shell.create()` + `runCommand(...)` (`.docs/sandpack-node-runtime/upstream/packages/nodebox/src/modules/shell.ts:27`)
- preview URLs are discovered with `preview.getByShellId(...)` or `preview.waitForPort(...)` (`.docs/sandpack-node-runtime/upstream/packages/nodebox/src/modules/preview.ts:23`)

## The biggest mismatch

`just-bash` wants a richer filesystem contract than Nodebox exposes.

`just-bash` `IFileSystem` expects methods like:

- `cp`
- `mv`
- `resolvePath`
- `getAllPaths`
- `chmod`
- `symlink`
- `link`
- `readlink`
- `lstat`
- `realpath`
- `utimes`

Source: `.docs/just-bash/upstream/src/fs/interface.ts:116`

Nodebox's public FS API only exposes:

- `init`
- `readFile`
- `writeFile`
- `readdir`
- `stat`
- `mkdir`
- `rm`
- `watch`

Source: `.docs/sandpack-node-runtime/upstream/packages/nodebox/src/modules/fs.ts:30`

So a direct "use Nodebox FS as just-bash FS" adapter is possible, but incomplete and awkward.

## Recommended architecture

Use a **canonical persistent workspace store** in the browser.

Suggested shape:

1. **Persistent store**
   - IndexedDB or OPFS-backed store of files/directories/metadata
   - this is the durable source of truth

2. **just-bash projection**
   - create a browser FS for `just-bash`
   - easiest path: extend or wrap `InMemoryFs`, then persist snapshots/deltas to IndexedDB
   - this is easier than implementing `IFileSystem` from scratch because `Bash` bootstrapping expects sync helpers like `mkdirSync` and `writeFileSync` for `/bin`, `/usr/bin`, `/dev`, `/proc` setup (`.docs/just-bash/upstream/src/fs/init.ts:12`, `.docs/just-bash/upstream/src/Bash.ts:482`)

3. **Nodebox projection**
   - create one long-lived `Nodebox` instance for the app
   - on startup, hydrate it from the canonical file snapshot using `nodebox.fs.init(...)`
   - apply later file deltas with `nodebox.fs.writeFile`, `mkdir`, and `rm`

4. **Bidirectional sync**
   - editor change -> store -> just-bash FS -> Nodebox FS
   - Nodebox `fs.watch(...)` change -> store -> just-bash FS
   - bash-created file change -> store -> Nodebox FS

## Why this is better than a direct adapter

### Option A: Canonical store + two projections

Pros:

- durable persistence is explicit
- each runtime keeps the API shape it expects
- easier to debug sync problems
- easier to reset/replay a workspace

Cons:

- you must build a sync layer

### Option B: just-bash talks directly to Nodebox FS

Pros:

- one live runtime filesystem

Cons:

- you must implement missing `IFileSystem` methods yourself
- recursive listing for `getAllPaths()` must be synthesized via repeated `readdir/stat`
- symlink/permission/path APIs are not clearly available from Nodebox public API
- persistence still needs a separate layer anyway

## Borrow the Sandpack sync pattern

The main Sandpack client already does part of the sync pattern you need:

- it initializes Nodebox with a full files snapshot (`.docs/sandpack/upstream/sandpack-client/src/clients/node/index.ts:78`)
- when editor files change and the shell is running, it writes deltas into Nodebox FS (`.docs/sandpack/upstream/sandpack-client/src/clients/node/index.ts:394`)
- it also subscribes to runtime FS changes and emits `fs/change` / `fs/remove` back to host state (`.docs/sandpack/upstream/sandpack-client/src/clients/node/index.ts:272`)

That is a strong model to reuse for your app.

## Persistence reality check

### just-bash

- persists only in memory by default via `InMemoryFs`
- can be hydrated with `initialFiles`
- does not ship a built-in snapshot/export API

### Nodebox

- persists only for the life of the runtime session by default
- can be hydrated with `fs.init(...)`
- does not ship a built-in durable storage layer

So persistence is your responsibility in both systems.

## Runtime constraints you should design around

### just-bash constraints

- no browser `js-exec`, Python, SQLite, or real host FS from the browser bundle (`.docs/just-bash/upstream/src/browser.ts:4`)
- shell state is not a long-lived session between `exec()` calls (`.docs/just-bash/upstream/src/Bash.ts:556`)

### Nodebox constraints

- no native addons / N-API, no external raw sockets, no sync exec/spawn (`.docs/sandpack-node-runtime/upstream/README.md:54`)
- first startup needs network to fetch packages and preview domains (`.docs/sandpack/upstream/website/docs/src/pages/resources/faq.mdx:53`)
- process lifecycle is not identical to real Node; manual `process.exit()` or shell restart may be needed (`.docs/sandpack/upstream/website/docs/src/pages/resources/faq.mdx:137`)

## Best practical plan

If you build this now, I would do it like this:

1. create `PersistentInMemoryFs` for `just-bash` by extending `InMemoryFs`
2. persist every FS mutation into IndexedDB
3. boot one app-level `Nodebox` instance
4. hydrate Nodebox from the same stored snapshot
5. mirror file deltas both ways
6. treat `just-bash` as the terminal/text-processing layer
7. treat Nodebox as the code-execution/preview layer

## Most relevant files to study next

- `just-bash`
  - `.docs/just-bash/upstream/src/Bash.ts`
  - `.docs/just-bash/upstream/src/browser.ts`
  - `.docs/just-bash/upstream/src/fs/interface.ts`
  - `.docs/just-bash/upstream/src/fs/in-memory-fs/in-memory-fs.ts`
  - `.docs/just-bash/upstream/src/fs/init.ts`

- `Nodebox`
  - `.docs/sandpack-node-runtime/upstream/packages/nodebox/src/Nodebox.ts`
  - `.docs/sandpack-node-runtime/upstream/packages/nodebox/src/modules/fs.ts`
  - `.docs/sandpack-node-runtime/upstream/packages/nodebox/src/modules/shell.ts`
  - `.docs/sandpack-node-runtime/upstream/packages/nodebox/src/modules/preview.ts`

- `Sandpack integration`
  - `.docs/sandpack/upstream/sandpack-client/src/clients/node/index.ts`
  - `.docs/sandpack/upstream/sandpack-client/src/clients/node/client.utils.ts`
  - `.docs/sandpack/upstream/website/docs/src/pages/resources/faq.mdx`
