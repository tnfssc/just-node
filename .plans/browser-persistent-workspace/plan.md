# Browser Node.js Dev Environment Plan

## Vision

Build a full browser-based development environment for Node.js projects that feels like a lightweight local IDE.

The environment should let a user:

- create, edit, rename, move, and delete files
- persist the entire workspace across reloads
- inspect and manipulate files from a terminal
- search the project with `grep`, `rg`, `find`, `sed`, `awk`, pipes, redirections, and shell-like workflows
- install dependencies from the terminal with an `npm`-compatible UX
- run Node.js scripts and dev servers in the browser
- open and refresh app previews
- keep editor, terminal, runtime, and preview in sync

This is not a toy playground. The target is a credible browser IDE for small and medium Node.js projects.

## Product Goal

Deliver a browser app where a user can open the page, create or import a Node.js project, work on it for multiple sessions, run it, install packages, debug basic issues, and return later to the same state.

## Primary Use Cases

### Use Case 1: Start from a template

The user chooses a starter like Vite, Express, or bare Node and immediately gets:

- workspace files
- a terminal
- preview support when relevant
- persistence across reloads

### Use Case 2: Build from scratch

The user creates `package.json`, source files, and folders manually, then uses terminal commands and `npm install` to bootstrap a project.

### Use Case 3: Edit and run repeatedly

The user iterates on files while a dev server is running and sees preview updates or can restart the runtime quickly.

### Use Case 4: Return later

The user closes the tab, comes back later, and the workspace is restored with files, terminal history, dependency metadata, and last-known project state.

## Scope

### In Scope

- browser-persistent project workspace
- shell-like terminal powered by `just-bash`
- Node-compatible execution powered by `Nodebox`
- npm-style dependency and script workflow
- project explorer and text editing
- preview lifecycle for browser-facing apps
- synchronization between editor, shell, and runtime

### Out of Scope for v1

- full Linux or POSIX compatibility
- arbitrary native binaries
- Docker, containers, or VM-grade isolation
- raw TCP databases like local Postgres or MongoDB
- full debugging protocol support
- large monorepos or native addon-heavy stacks

## Non-Goals

- fully replacing local VS Code
- full npm feature parity
- supporting every Node.js package
- perfect runtime parity with desktop Node.js

## Technical Strategy Summary

Use a three-layer model:

1. canonical persistent workspace store
2. `just-bash` shell projection for terminal workflows
3. `Nodebox` runtime projection for Node execution and previews

The core design principle is that the persistent store is the source of truth. `just-bash` and `Nodebox` are consumers of that state, not competing authorities.

## Architectural Principles

- single source of truth for workspace state
- all file mutations flow through one coordinator
- terminal UX should feel native even if implementation is virtualized
- runtime should be long-lived, but restartable
- every major state transition must be observable and recoverable
- persistence must be explicit and testable

## System Overview

### Core Subsystems

#### WorkspaceStore

Persistent browser storage for workspace files, directories, metadata, session state, and indexes.

#### WorkspaceCoordinator

Central authority for applying mutations and distributing them to shell, editor, runtime, and preview subsystems.

#### BashService

Wraps `just-bash`, exposes terminal command execution, and registers custom commands like `npm`.

#### PersistentInMemoryFs

Browser-persistent filesystem layer compatible with `just-bash`, built on top of `InMemoryFs` plus persistence and mutation tracking.

#### NodeboxService

Owns a singleton `Nodebox` instance, runtime hydration, shell processes, stdout/stderr streaming, dependency readiness, and preview URLs.

#### NpmShimService

Implements an `npm`-compatible user experience by mutating `package.json`, coordinating dependency readiness, and delegating script execution to Nodebox.

#### EditorService

Tracks open files, dirty buffers, saved state, and write-through behavior to the workspace coordinator.

#### PreviewService

Tracks active preview process, preview URLs, navigation events, reloads, and restart flows.

#### TerminalSessionService

Provides app-level shell state not natively preserved by `just-bash`, including cwd, exported env, history, aliases if desired, and session replay.

## Core Architectural Decision

Do not make `Nodebox` the filesystem for `just-bash`.

Reasons:

- `just-bash` expects a richer filesystem contract than Nodebox exposes publicly
- `just-bash` benefits from sync-style FS helpers during bootstrapping
- persistence is needed regardless, so a canonical store still has to exist
- a direct adapter would tightly couple two different abstractions and make recovery harder

## Filesystem Design

### Canonical Storage Backend

#### v1 choice

- IndexedDB as the primary durable backend

#### v2 option

- OPFS for large file handling or faster binary access if needed

### Canonical Data Model

Track at minimum:

- normalized absolute path
- file or directory type
- file content as text or binary
- mtime / ctime / last writer metadata
- optional hash for change detection
- optional derived metadata for indexes and previews

### Filesystem Mutation Model

All operations become explicit workspace mutations:

- `writeFile`
- `mkdir`
- `rm`
- `rename`
- `move`
- `copy`
- `touch`
- bulk import
- snapshot restore

Each mutation should include:

- unique id
- origin (`editor`, `bash`, `nodebox`, `system`)
- timestamp
- path set affected
- previous revision and next revision when available

### Filesystem Snapshots

Support:

- full workspace export
- full workspace import
- incremental hydration from stored state
- reset to template

## Shell / Terminal Design

### just-bash role

Use `just-bash` as the terminal computation engine for:

- file inspection
- file mutation
- text search and processing
- shell pipelines
- shell redirections and globs
- project analysis workflows

### Important just-bash constraint

Filesystem state persists on the `Bash` instance, but shell state does not naturally behave like a long-lived interactive session across `exec()` calls.

Therefore terminal session state must be implemented at the app layer.

### Terminal App State

Persist and restore:

- cwd
- exported env vars
- command history
- optionally aliases and shell preferences

### Terminal UX requirements

- command input with history navigation
- stdout/stderr rendering
- exit code awareness
- basic copy/paste
- interrupt support where possible
- clear distinction between bash-side commands and Nodebox-run commands

## Node Runtime Design

### Nodebox role

Use `Nodebox` for:

- running Node-compatible scripts
- launching dev servers
- executing `npm run <script>`
- serving previews
- resolving and caching dependencies based on `package.json`

### Nodebox lifecycle

- one singleton instance per workspace/app shell
- connect once per page session
- hydrate from canonical workspace snapshot on startup
- apply deltas as files change
- restart shell processes or preview processes as needed

### Runtime process model

Need explicit management for:

- currently running process
- process stdout/stderr streams
- process state (`starting`, `running`, `stopped`, `errored`)
- preview port or preview URL
- manual restart and stop flows

### Runtime limitations that must shape product design

- no native addons / N-API
- no external raw sockets
- not full Node.js parity
- dependency availability depends on Nodebox-compatible packages
- larger projects may stress memory or startup time

## npm Compatibility Strategy

### Product position

Expose an `npm` command in the terminal because users expect it, but implement only the subset that supports the browser IDE workflow.

### Design principle

`npm` is a user experience contract, not a real bundled npm CLI.

### v1 supported commands

- `npm install <pkg...>`
- `npm install -D <pkg...>`
- `npm uninstall <pkg...>`
- `npm run <script> [-- extraArgs...]`
- `npm exec <bin>` only if it can be delegated cleanly to Nodebox later

### v1 unsupported commands

- `npm audit`
- `npm publish`
- `npm login`
- arbitrary registry auth flows
- lockfile parity with desktop npm
- workspaces / monorepo commands unless intentionally added later

### npm install flow

1. parse arguments
2. load `/package.json`
3. update dependency entries
4. save to canonical store
5. propagate to just-bash projection
6. propagate to Nodebox filesystem
7. wait for dependency readiness signal
8. emit terminal output describing what happened

### npm run flow

1. validate script exists in `package.json`
2. ensure runtime is connected and hydrated
3. create a Nodebox shell process
4. run `npm run <script>` inside Nodebox
5. stream stdout/stderr into terminal
6. attach preview if the script opens a port

### Readiness problem

Nodebox dependency installation is not guaranteed to be synchronously complete the moment `package.json` is written.

v1 must include a readiness strategy such as:

- a dummy command barrier
- shell progress inspection
- post-write verification command
- fallback timeout and user-visible status

## Synchronization Design

### Single-writer policy

All file writes must be serialized through the workspace coordinator even if they originate from different subsystems.

### Mutation sources

- editor save
- bash file mutation
- npm shim package change
- Nodebox FS watch event
- template import / reset

### Propagation routes

- editor -> canonical -> bash -> nodebox
- bash -> canonical -> editor -> nodebox
- nodebox -> canonical -> editor -> bash

### Conflict model for v1

- last-write-wins with revision checks
- no concurrent collaborative editing model
- avoid multi-writer races by queueing mutations through one async pipeline

### Recovery model

If sync fails for one projection:

- canonical state remains authoritative
- failed subsystem is marked stale
- subsystem can be rehydrated from canonical snapshot

## Editor / IDE Features

### v1 editor features

- file tree
- open tabs
- text editing
- save / autosave
- rename / move / delete
- create file / folder
- unsaved state indicator

### v1 nice-to-haves

- search in files UI backed by `rg`
- replace in files
- diagnostics view for runtime output
- preview split pane

### v2 features

- multi-workspace support
- terminal tabs
- richer settings
- template marketplace

## Workspace Lifecycle

### Create workspace

Support:

- from empty project
- from built-in template
- from imported snapshot

### Open workspace

On app start:

1. load last active workspace id
2. hydrate canonical snapshot
3. rebuild bash projection
4. connect Nodebox
5. hydrate Nodebox FS
6. restore open files, terminal state, and preview state where possible

### Reset workspace

Support:

- soft reset of runtime only
- hard reset of files to last snapshot
- restore starter template

## State Persistence Plan

### Persisted state

- workspace files and directories
- workspace metadata
- open file tabs
- active file
- terminal history
- cwd and exported shell env
- selected template or project type
- package metadata cache if useful
- last known run command and preview state

### Session-only state

- active running process handles
- live preview iframe object references
- in-flight installs or commands

## Security and Isolation Considerations

### Security posture

This is a sandboxed browser app, not a hardened multi-tenant security boundary.

### Relevant constraints

- `just-bash` is safer than spawning a real shell, but still runs script logic inside the app context
- Nodebox is Node-compatible, not full Node isolation
- dependency installation pulls third-party packages into a browser runtime model

### Product implications

- avoid promising production-grade isolation
- clearly document unsupported and risky package classes
- reset and delete flows must be reliable
- keep runtime and app trust boundaries conceptually separate where possible

## Observability and Diagnostics

Need internal observability for:

- workspace mutation log
- sync failures
- runtime hydration time
- dependency install duration
- preview boot failures
- shell exit codes

Diagnostic UI should expose at least:

- last command
- active process state
- current preview URL
- recent sync or runtime errors

## Performance Targets

### v1 performance goals

- workspace restore should feel immediate for small projects
- terminal commands should feel responsive for typical text workflows
- file edits should sync to runtime with low visible lag
- preview restarts should be fast enough to support iterative development

### Performance constraints to watch

- large file trees in IndexedDB
- repeated full hydration of Nodebox
- expensive recursive searches
- runtime memory growth after many restarts

## Testing Strategy

### Unit tests

- workspace store behavior
- path normalization
- mutation queue ordering
- npm shim argument parsing
- package.json mutation correctness

### Integration tests

- editor write -> bash visibility
- bash write -> editor visibility
- package install -> runtime ready -> script run
- Nodebox file watch -> canonical sync -> bash visibility

### End-to-end tests

- create Vite app, install deps, run preview, reload page, continue editing
- create Express app, run server, inspect logs, restart process
- use terminal to create files and verify editor updates

### Failure-mode tests

- interrupted install
- stale runtime needing rehydrate
- corrupted workspace snapshot
- unsupported package install

## Delivery Phases

## Phase 0 - Research Validation

Deliverables:

- validate integration model against `just-bash`, `Nodebox`, and Sandpack internals
- document product constraints and technical assumptions

Acceptance criteria:

- architecture is written down and references the relevant upstream behavior
- main unsupported cases are identified before implementation

## Phase 1 - Workspace Core

Deliverables:

- `WorkspaceStore`
- IndexedDB persistence
- snapshot import/export
- mutation event model
- workspace metadata model

Acceptance criteria:

- creating files and directories updates stored workspace state
- deleting or renaming files persists correctly across reloads
- binary and text file storage paths are defined and tested
- a reloaded app restores the last saved file tree exactly

## Phase 2 - Shell Foundation

Deliverables:

- `PersistentInMemoryFs`
- `BashService`
- terminal UI and session state
- command execution pipeline

Acceptance criteria:

- `touch`, `mkdir`, `mv`, `cp`, `rm`, `cat`, `grep`, `rg`, `sed`, `awk`, `find`, pipes, and redirects work on workspace files
- command results appear in terminal with stdout, stderr, and exit code
- file mutations performed via terminal persist across reloads
- terminal cwd and command history survive page reload if persistence is enabled

## Phase 3 - Editor Foundation

Deliverables:

- file explorer
- editor tabs
- save / autosave
- create / rename / delete UI

Acceptance criteria:

- editor changes update the canonical store
- saving a file updates the bash-visible filesystem
- renaming and deleting from the UI updates file tree and terminal-visible state immediately
- unsaved changes are clearly surfaced

## Phase 4 - Node Runtime Foundation

Deliverables:

- `NodeboxService`
- singleton runtime lifecycle
- initial hydration from canonical store
- process management and log streaming

Acceptance criteria:

- a bare Node script can run in-browser and print logs
- a Vite-like project can boot a preview
- runtime stdout/stderr appears in the UI
- stopping and restarting the active process works reliably

## Phase 5 - Sync Engine

Deliverables:

- coordinator-driven mutation pipeline
- Nodebox watch reconciliation
- projection rehydration logic
- stale subsystem recovery flow

Acceptance criteria:

- file edits made in the editor become visible to terminal and runtime without full workspace reset
- files created by terminal commands become visible in editor and runtime
- files written by runtime become visible in editor and terminal
- if runtime sync fails, the app can rehydrate runtime from canonical state without data loss

## Phase 6 - npm Shim

Deliverables:

- custom `npm` command in `just-bash`
- `NpmShimService`
- package.json helpers
- dependency readiness flow

Acceptance criteria:

- `npm install react` updates `package.json` and produces a usable runtime state
- `npm install -D vite` updates the correct dependency bucket
- `npm uninstall react` removes the package cleanly
- `npm run dev` starts the correct process and exposes preview/logs
- unsupported npm subcommands fail with clear, intentional errors

## Phase 7 - Preview UX

Deliverables:

- preview panel
- reload button
- open in new tab
- runtime status and process controls

Acceptance criteria:

- preview URL is discoverable and stable while the process is running
- the user can manually reload or restart the preview
- preview failures are visible and diagnosable from the UI

## Phase 8 - Persistence Polish

Deliverables:

- restore previous session state
- workspace switching foundation if desired
- import/export UX

Acceptance criteria:

- reloading the page restores files, open tabs, terminal history, and last active workspace state
- export and import preserve a functioning project snapshot

## Phase 9 - Hardening

Deliverables:

- resilience improvements
- telemetry and diagnostics
- unsupported-case handling
- performance tuning

Acceptance criteria:

- the app handles runtime restarts, failed installs, and sync errors without silent corruption
- unsupported packages or commands fail clearly
- small and medium projects remain usable after repeated edits and restarts

## Functional Acceptance Criteria

The product is accepted for v1 when all of the following are true.

### Workspace

- the user can create a project from empty state or template
- the workspace persists across browser reloads
- restoring the workspace preserves file tree and content accurately

### Editor

- the user can create, edit, rename, move, and delete files and folders
- saved editor changes are reflected in terminal and runtime

### Terminal

- the user can run common shell-style project commands using `just-bash`
- the terminal supports file search, content search, and redirections on workspace files
- history and cwd persistence behave consistently

### npm UX

- the user can install and uninstall dependencies from the terminal using the supported npm subset
- the user can run package scripts from the terminal

### Runtime

- the user can run a Node.js entrypoint or package script in-browser
- runtime logs are visible
- the user can stop and restart the running process

### Preview

- browser-facing projects can expose a preview panel
- preview can recover after file changes or manual restart

### Sync

- editor, shell, and runtime views of the workspace converge on the same file state
- failures in one subsystem do not silently corrupt canonical state

## Non-Functional Acceptance Criteria

### Reliability

- no user file mutations are silently dropped during normal flows
- subsystem restarts can rehydrate from canonical state

### Usability

- the environment feels coherent enough that a user understands where files, logs, and preview state live
- failures return actionable messages

### Performance

- common commands and file edits feel interactive on small and medium projects

### Maintainability

- core services are separated by responsibility
- mutation flow is testable and observable

## Example v1 Project Types

v1 should explicitly target these as acceptance scenarios:

- bare Node script project
- Express server project
- Vite React app
- Vite Vue or Svelte app if compatible

## Unsupported / Risky Scenarios to Document Clearly

- packages relying on native addons
- packages relying on external socket databases
- very large dependency graphs
- large monorepos
- full npm parity expectations

## Open Questions

- Should we support multiple concurrent terminal sessions in v1 or only one?
- Should autosave be default-on?
- Do we need lockfile generation, or is `package.json` enough for v1?
- How should dependency readiness be surfaced to the user during install?
- Should preview auto-restart on file changes or require explicit control first?

## Recommended Initial Implementation Order

1. `WorkspaceStore`
2. `PersistentInMemoryFs`
3. `BashService`
4. terminal UI and session state
5. editor + explorer
6. `NodeboxService`
7. runtime process management
8. sync engine
9. npm shim
10. preview polish and persistence restoration

## Definition of Done for v1

The product is done for v1 when a user can:

- open the browser app and create a Node.js project
- edit files in an IDE-like UI
- use a terminal to inspect and mutate the workspace
- install dependencies with the supported `npm` subset
- run a dev server or Node script in-browser
- view logs and preview output
- reload the page and return to the same workspace state
- continue iterating without manually rebuilding the environment from scratch
