# Browser Node.js Dev Environment Tickets

This file breaks the plan into implementation epics and concrete tickets.

Status key:

- `todo`
- `in_progress`
- `blocked`
- `done`

Priority key:

- `P0` critical for first usable product
- `P1` important for strong v1
- `P2` useful after core loop works

## Delivery Order

Recommended execution order:

1. Epic 1 - Workspace Core
2. Epic 2 - Shell Foundation
3. Epic 3 - Editor Foundation
4. Epic 4 - Nodebox Runtime Foundation
5. Epic 5 - Sync Engine
6. Epic 6 - npm Shim
7. Epic 7 - Preview UX
8. Epic 8 - Persistence Polish
9. Epic 9 - Hardening

## Epic 1 - Workspace Core

Goal:

Create the canonical persistent workspace store and mutation model.

Exit criteria:

- workspace files persist across reloads
- file tree can be restored exactly
- all file mutations go through one API

### Ticket 1.1 - Define workspace domain model

- Status: `todo`
- Priority: `P0`
- Dependencies: none
- Deliverables:
  - path model
  - file and directory record types
  - mutation event type
  - workspace metadata type
- Acceptance criteria:
  - all workspace operations can be expressed using the domain types
  - paths are normalized consistently
  - mutation origin is tracked (`editor`, `bash`, `nodebox`, `system`)

### Ticket 1.2 - Implement `WorkspaceStore` interface

- Status: `todo`
- Priority: `P0`
- Dependencies: 1.1
- Deliverables:
  - read/write file methods
  - mkdir/rm/rename/move methods
  - snapshot import/export methods
  - list and stat methods
- Acceptance criteria:
  - store API covers all v1 file operations
  - store methods return consistent errors for missing or invalid paths

### Ticket 1.3 - Build IndexedDB storage adapter

- Status: `todo`
- Priority: `P0`
- Dependencies: 1.2
- Deliverables:
  - IndexedDB-backed implementation
  - workspace bootstrap and migration logic
  - support for text and binary file contents
- Acceptance criteria:
  - creating files persists across reloads
  - deleting files persists across reloads
  - binary and text files round-trip correctly

### Ticket 1.4 - Add workspace snapshot import/export

- Status: `todo`
- Priority: `P1`
- Dependencies: 1.3
- Deliverables:
  - full snapshot serializer
  - full snapshot hydrator
  - reset-to-snapshot flow
- Acceptance criteria:
  - exporting and reimporting a workspace restores file contents and directories accurately

### Ticket 1.5 - Create `WorkspaceCoordinator`

- Status: `todo`
- Priority: `P0`
- Dependencies: 1.2
- Deliverables:
  - mutation queue
  - event subscription API
  - revision tracking
- Acceptance criteria:
  - mutations are serialized in order
  - subscribers receive normalized mutation events
  - failed projection updates do not corrupt canonical state

## Epic 2 - Shell Foundation

Goal:

Provide a persistent browser shell powered by `just-bash`.

Exit criteria:

- common shell file workflows work on the persistent workspace
- terminal-visible mutations persist

### Ticket 2.1 - Implement `PersistentInMemoryFs`

- Status: `todo`
- Priority: `P0`
- Dependencies: 1.3, 1.5
- Deliverables:
  - wrapper or subclass around `InMemoryFs`
  - hydration from `WorkspaceStore`
  - mutation persistence hooks
- Acceptance criteria:
  - `just-bash` can read the restored workspace
  - writes through the FS persist into canonical storage

### Ticket 2.2 - Implement `BashService`

- Status: `todo`
- Priority: `P0`
- Dependencies: 2.1
- Deliverables:
  - `Bash` instance lifecycle
  - `exec(command, options)` wrapper
  - result normalization for stdout/stderr/exitCode
- Acceptance criteria:
  - commands can be executed programmatically against the workspace
  - service exposes enough data for terminal UI rendering

### Ticket 2.3 - Build terminal session state model

- Status: `todo`
- Priority: `P1`
- Dependencies: 2.2
- Deliverables:
  - cwd persistence
  - command history
  - exported env persistence
- Acceptance criteria:
  - cwd can be restored between terminal commands
  - command history survives reloads if persistence is enabled

### Ticket 2.4 - Add terminal UI

- Status: `todo`
- Priority: `P1`
- Dependencies: 2.2, 2.3
- Deliverables:
  - input prompt
  - stdout/stderr rendering
  - history navigation
  - command exit state rendering
- Acceptance criteria:
  - user can run shell commands interactively
  - terminal distinguishes stdout and stderr clearly enough for debugging

### Ticket 2.5 - Validate core shell command workflows

- Status: `todo`
- Priority: `P0`
- Dependencies: 2.2
- Deliverables:
  - test coverage for `touch`, `mkdir`, `mv`, `cp`, `rm`, `cat`, `grep`, `rg`, `sed`, `awk`, `find`, pipes, redirects
- Acceptance criteria:
  - these commands work against workspace files and persist expected mutations

## Epic 3 - Editor Foundation

Goal:

Provide IDE-like file editing on top of the canonical workspace.

Exit criteria:

- user can browse, open, edit, save, rename, and delete files

### Ticket 3.1 - Build file tree model and explorer UI

- Status: `todo`
- Priority: `P0`
- Dependencies: 1.3
- Deliverables:
  - tree derivation from workspace state
  - file/folder create flows
  - rename/delete UI actions
- Acceptance criteria:
  - file explorer reflects current workspace accurately

### Ticket 3.2 - Add editor tabs and buffer state

- Status: `todo`
- Priority: `P0`
- Dependencies: 3.1
- Deliverables:
  - open tab state
  - active file state
  - dirty buffer tracking
- Acceptance criteria:
  - multiple files can be opened and switched without losing unsaved changes

### Ticket 3.3 - Implement save and autosave behavior

- Status: `todo`
- Priority: `P1`
- Dependencies: 3.2, 1.5
- Deliverables:
  - save action
  - optional autosave
  - write-through to workspace coordinator
- Acceptance criteria:
  - saved files are visible immediately to shell and runtime projections

### Ticket 3.4 - Persist editor session state

- Status: `todo`
- Priority: `P2`
- Dependencies: 3.2, 1.3
- Deliverables:
  - restore open tabs
  - restore active file
- Acceptance criteria:
  - reload restores prior editing context

## Epic 4 - Nodebox Runtime Foundation

Goal:

Run Node.js-compatible code and dev servers in-browser.

Exit criteria:

- scripts run inside Nodebox
- runtime logs are visible
- previews can be booted for app projects

### Ticket 4.1 - Implement `NodeboxService`

- Status: `todo`
- Priority: `P0`
- Dependencies: 1.3
- Deliverables:
  - singleton runtime lifecycle
  - connect/disconnect behavior
  - service state machine
- Acceptance criteria:
  - one Nodebox instance can be created and reused within the app session

### Ticket 4.2 - Hydrate runtime filesystem from workspace snapshot

- Status: `todo`
- Priority: `P0`
- Dependencies: 4.1, 1.3
- Deliverables:
  - initial FS snapshot projection into Nodebox
  - full rehydrate flow
- Acceptance criteria:
  - Nodebox sees the same project files as the canonical workspace after boot

### Ticket 4.3 - Implement process management and log streaming

- Status: `todo`
- Priority: `P0`
- Dependencies: 4.1
- Deliverables:
  - start process
  - stop process
  - restart process
  - stdout/stderr event bridge
- Acceptance criteria:
  - running process state is observable
  - logs stream into the UI reliably

### Ticket 4.4 - Support basic script execution scenarios

- Status: `todo`
- Priority: `P0`
- Dependencies: 4.2, 4.3
- Deliverables:
  - bare `node index.js`
  - package script execution
  - preview detection hooks
- Acceptance criteria:
  - bare Node project runs
  - at least one preview-capable app project runs

## Epic 5 - Sync Engine

Goal:

Keep editor, shell, runtime, and preview aligned with canonical state.

Exit criteria:

- mutations converge consistently across subsystems
- runtime can be rehydrated after drift or failure

### Ticket 5.1 - Add mutation propagation from canonical store to projections

- Status: `todo`
- Priority: `P0`
- Dependencies: 1.5, 2.1, 4.2
- Deliverables:
  - canonical -> bash propagation
  - canonical -> nodebox propagation
- Acceptance criteria:
  - changes saved in editor are visible in terminal and runtime without full reset

### Ticket 5.2 - Add Nodebox watch reconciliation

- Status: `todo`
- Priority: `P0`
- Dependencies: 4.1, 1.5
- Deliverables:
  - runtime FS watch integration
  - nodebox -> canonical mutation bridge
- Acceptance criteria:
  - runtime-created files become visible in editor and shell

### Ticket 5.3 - Add stale projection detection and recovery

- Status: `todo`
- Priority: `P1`
- Dependencies: 5.1, 5.2
- Deliverables:
  - stale state markers
  - full rehydrate commands
- Acceptance criteria:
  - a broken runtime projection can be rebuilt from canonical state without data loss

### Ticket 5.4 - Add mutation conflict rules

- Status: `todo`
- Priority: `P1`
- Dependencies: 1.5, 5.1
- Deliverables:
  - revision checks
  - last-write-wins policy implementation
- Acceptance criteria:
  - mutation ordering is deterministic under normal single-user workflows

## Epic 6 - npm Shim

Goal:

Provide a familiar npm UX inside the terminal that works with Nodebox.

Exit criteria:

- install, uninstall, and run workflows are usable for v1 projects

### Ticket 6.1 - Define supported npm command grammar

- Status: `todo`
- Priority: `P0`
- Dependencies: none
- Deliverables:
  - supported subcommands and flags
  - unsupported command behavior spec
- Acceptance criteria:
  - npm UX scope is explicit and testable

### Ticket 6.2 - Implement `NpmShimService`

- Status: `todo`
- Priority: `P0`
- Dependencies: 6.1, 1.5, 4.1
- Deliverables:
  - install/uninstall package.json mutation helpers
  - run-script bridge to Nodebox
- Acceptance criteria:
  - package dependency mutations are reflected in canonical store and runtime projection

### Ticket 6.3 - Register custom `npm` command in `just-bash`

- Status: `todo`
- Priority: `P0`
- Dependencies: 2.2, 6.2
- Deliverables:
  - `defineCommand("npm", ...)`
  - terminal-facing stdout/stderr messages
- Acceptance criteria:
  - terminal users can invoke supported npm commands naturally

### Ticket 6.4 - Implement dependency readiness flow

- Status: `todo`
- Priority: `P0`
- Dependencies: 6.2, 4.1
- Deliverables:
  - readiness barrier after dependency mutation
  - timeout and failure handling
- Acceptance criteria:
  - after `npm install`, the runtime becomes usable without hidden race conditions in supported scenarios

### Ticket 6.5 - Add npm UX tests

- Status: `todo`
- Priority: `P1`
- Dependencies: 6.3, 6.4
- Deliverables:
  - tests for `npm install`, `npm install -D`, `npm uninstall`, `npm run`
- Acceptance criteria:
  - supported commands pass repeatable integration tests

## Epic 7 - Preview UX

Goal:

Make browser-facing apps easy to run and inspect.

Exit criteria:

- preview is visible, restartable, and understandable

### Ticket 7.1 - Build preview panel and state model

- Status: `todo`
- Priority: `P1`
- Dependencies: 4.3
- Deliverables:
  - preview URL state
  - iframe panel
  - loading and error states
- Acceptance criteria:
  - user can see active preview state clearly

### Ticket 7.2 - Add preview controls

- Status: `todo`
- Priority: `P1`
- Dependencies: 7.1
- Deliverables:
  - reload button
  - open in new tab
  - restart process action
- Acceptance criteria:
  - user can recover from preview issues without hard reloading the whole app

### Ticket 7.3 - Decide and implement preview auto-refresh behavior

- Status: `todo`
- Priority: `P2`
- Dependencies: 5.1, 7.1
- Deliverables:
  - policy for manual vs automatic refresh
  - minimal implementation
- Acceptance criteria:
  - preview refresh behavior is predictable and documented

## Epic 8 - Persistence Polish

Goal:

Make the environment feel durable and resumable.

Exit criteria:

- user can leave and return to meaningful prior state

### Ticket 8.1 - Restore last active workspace on boot

- Status: `todo`
- Priority: `P1`
- Dependencies: 1.3, 3.4, 2.3
- Deliverables:
  - last workspace selection
  - session restoration flow
- Acceptance criteria:
  - page reload restores prior workspace automatically

### Ticket 8.2 - Persist terminal and editor session details

- Status: `todo`
- Priority: `P1`
- Dependencies: 2.3, 3.4
- Deliverables:
  - restore history, cwd, open files, active tab
- Acceptance criteria:
  - user can continue from roughly the same IDE state after reload

### Ticket 8.3 - Add import/export workspace UX

- Status: `todo`
- Priority: `P2`
- Dependencies: 1.4
- Deliverables:
  - export action
  - import action
- Acceptance criteria:
  - user can move a workspace snapshot into and out of the app

## Epic 9 - Hardening and Observability

Goal:

Make the environment reliable enough for repeated use.

Exit criteria:

- failures are visible and recoverable
- core flows are covered by tests

### Ticket 9.1 - Add diagnostic event logging

- Status: `todo`
- Priority: `P1`
- Dependencies: 1.5, 4.3, 5.1
- Deliverables:
  - mutation log
  - runtime state log
  - sync failure log
- Acceptance criteria:
  - developers can inspect why a workspace or runtime became inconsistent

### Ticket 9.2 - Add user-facing error surfaces

- Status: `todo`
- Priority: `P1`
- Dependencies: 2.4, 4.3, 7.1
- Deliverables:
  - terminal errors
  - runtime failure banners
  - preview failure messages
- Acceptance criteria:
  - failures are not silent and give actionable information

### Ticket 9.3 - Build end-to-end acceptance scenarios

- Status: `todo`
- Priority: `P0`
- Dependencies: 6.5, 7.2, 8.2
- Deliverables:
  - bare Node project scenario
  - Express scenario
  - Vite app scenario
- Acceptance criteria:
  - all target v1 project types pass scripted acceptance flows

### Ticket 9.4 - Add recovery flows for failed runtime state

- Status: `todo`
- Priority: `P1`
- Dependencies: 5.3, 9.2
- Deliverables:
  - rehydrate runtime button or command
  - restart runtime button or command
- Acceptance criteria:
  - user can recover from stale runtime state without losing workspace files

## Suggested First Sprint

Recommended first implementation batch:

- 1.1 Define workspace domain model
- 1.2 Implement `WorkspaceStore` interface
- 1.3 Build IndexedDB storage adapter
- 1.5 Create `WorkspaceCoordinator`
- 2.1 Implement `PersistentInMemoryFs`
- 2.2 Implement `BashService`

Sprint acceptance criteria:

- app can create and persist files in a canonical store
- `just-bash` can operate on the restored workspace
- file writes through bash persist across reloads

## Suggested Second Sprint

- 2.3 Build terminal session state model
- 2.4 Add terminal UI
- 2.5 Validate core shell workflows
- 3.1 Build file tree model and explorer UI
- 3.2 Add editor tabs and buffer state

Sprint acceptance criteria:

- user can edit files and run terminal commands in one persistent workspace

## Suggested Third Sprint

- 3.3 Implement save and autosave behavior
- 4.1 Implement `NodeboxService`
- 4.2 Hydrate runtime filesystem from workspace snapshot
- 4.3 Implement process management and log streaming
- 4.4 Support basic script execution scenarios

Sprint acceptance criteria:

- user can run a simple Node project from the browser IDE and see logs

## Suggested Fourth Sprint

- 5.1 Add mutation propagation from canonical store to projections
- 5.2 Add Nodebox watch reconciliation
- 6.1 Define supported npm command grammar
- 6.2 Implement `NpmShimService`
- 6.3 Register custom `npm` command in `just-bash`
- 6.4 Implement dependency readiness flow

Sprint acceptance criteria:

- user can install a dependency, run a script, and see the runtime reflect project changes coherently
