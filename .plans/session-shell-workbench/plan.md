# Session Shell Workbench Plan

## Goal

Replace the current frontend completely with a minimal shell-first workbench inspired by the provided screenshot.

The new UI should prioritize:

- session management in a left sidebar
- terminal tabs in the main area
- real browser-backed shell/runtime behavior
- simple save, export, import, and restore flows

## Desired User Experience

The user lands in a sparse app with two regions:

1. a left sidebar for workspace sessions
2. a main area containing terminal tabs powered by xterm.js

The user can:

- create a new session as a fresh workspace/runtime instance
- switch between saved sessions
- save the current session into browser storage
- export the current session as a zip file
- import a zip file and create a new session from it
- open multiple terminal tabs against the same active session/filesystem
- keep all terminal tabs pointed at one shared workspace state for that session

## Product Shape

### Left Sidebar

The sidebar should include:

- app title / active workspace context
- a primary action to create a new session
- a list of saved sessions
- a visual active-session indicator
- lightweight metadata such as title and last updated time

Recommended simple controls:

- `New Session`
- `Save Session`
- `Export Zip`
- `Import Zip`

## Main Area

The main area should contain:

- terminal tabs across the top
- one active xterm.js terminal view
- affordance to create additional terminal tabs for the current session
- close control for non-last terminal tabs

No file tree, no editor, no preview panel, no diagnostic cards in the initial redesign.

## Scope

### In Scope

- complete removal of current multi-panel IDE UI
- xterm.js-based terminal rendering
- multiple terminal tabs per active session
- per-session shared filesystem/runtime backing
- session persistence in browser storage
- zip export of current session
- zip import into a newly created session
- clean session switching UX

### Out of Scope for This Redesign Pass

- embedded text editor
- preview iframe UI
- graphical file explorer
- advanced settings/preferences
- collaborative or remote sessions
- full VS Code-style workbench behavior

## Core Concepts

### Session

A session represents one persisted workspace identity.

Each session should own:

- session id
- display name
- created / updated timestamps
- canonical workspace snapshot
- terminal tab state metadata
- runtime metadata needed to recreate services

### Terminal Tab

A terminal tab is a view/controller bound to the currently active session.

Each terminal tab should track:

- tab id
- title
- scrollback buffer
- prompt/input state if needed
- current logical shell session state (cwd, env, history) if we preserve it per terminal

Important distinction:

- multiple tabs share one underlying filesystem for the active session
- tabs may or may not share shell state; this should be clarified before implementation

## Architecture Direction

## 1. SessionStore

Introduce a browser-persistent session registry separate from the current single-workspace storage shape.

Responsibilities:

- create session
- save session snapshot
- list sessions
- load session by id
- delete or archive session later if desired
- mark last active session

Recommended storage shape:

- one registry record for metadata
- one record per session snapshot

Short-term backend:

- localStorage is acceptable if session payload remains small

Better backend:

- IndexedDB should be the target if zip import/export and multiple sessions are first-class

## 2. WorkspaceSessionRuntime

Each active session should be backed by a runtime container object that owns:

- canonical workspace snapshot
- `BashWorkspace`
- `NodeboxRuntime`
- mutation sync coordination

This allows switching sessions by tearing down the active runtime container and hydrating a new one.

## 3. TerminalManager

Introduce a dedicated terminal tab manager for the active session.

Responsibilities:

- create/close/switch terminal tabs
- bind each tab to xterm.js instance state
- route commands to the correct shell/runtime integration
- preserve tab metadata when saving a session

## 4. Xterm Bridge

Replace the textarea terminal with xterm.js.

Recommended packages:

- `xterm`
- `@xterm/addon-fit`

Optional later:

- `@xterm/addon-web-links`
- `@xterm/addon-search`

Responsibilities:

- render prompt/output using xterm
- capture line input and special keys
- support resize on tab/container changes
- replay saved scrollback when switching tabs

## 5. Zip Import/Export

Introduce a session serializer/deserializer.

Export should include at minimum:

- workspace files/directories
- package.json and related source files
- session metadata

Import should:

- accept a zip file
- unpack files into a fresh session
- generate new session id and metadata
- avoid overwriting an existing session by default

Recommended libraries:

- `fflate` for zip creation/extraction, or
- `jszip` if API ergonomics are preferred over bundle size

## State Model Proposal

### Session Registry

- `sessions: SessionMeta[]`
- `lastActiveSessionId: string | null`

### Session Snapshot

- `id`
- `name`
- `workspace: WorkspaceSnapshot`
- `terminalTabs: TerminalTabSnapshot[]`
- `activeTerminalTabId`
- `createdAt`
- `updatedAt`

### TerminalTabSnapshot

- `id`
- `title`
- `cwd`
- `env`
- `history`
- `scrollback`

## Command Routing Model

Retain the current routing split:

- bash/file-oriented commands -> `just-bash`
- `npm run ...` / `node ...` -> Nodebox

Need to adapt routing to a per-terminal model so each tab can maintain its own command history and possibly its own cwd/env.

## Important Implementation Decision Points

### Terminal Isolation Model

Two reasonable options:

1. shared filesystem, independent terminal shell state per tab
2. shared filesystem and shared shell state across tabs

Recommended default:

- shared filesystem, independent cwd/env/history per tab

Reason:

- this matches user expectations for multiple terminal tabs better
- it avoids surprising cwd jumps across tabs

### Save Semantics

Two options:

1. manual save button commits current session snapshot
2. auto-persist continuously and make `Save` act as an explicit snapshot confirmation

Recommended implementation path:

- keep explicit `Save Session` behavior visible in UI
- still persist opportunistically in browser storage to reduce data loss risk

### Import Format

Two options:

1. raw project zip only
2. app-specific session zip containing metadata + project files

Recommended implementation path:

- support raw project zip import first
- export app-specific metadata only if needed for restoring terminal tabs later

## UI Structure Proposal

### Sidebar

- compact icon/header row
- primary session actions row
- vertical session list

### Main Workspace

- top tab strip with terminal tabs and `+`
- single terminal canvas below

### Empty States

- no session yet -> show `New Session` and `Import Zip`
- no terminal tab -> auto-create one for the active session

## Migration Plan

### Phase 1 - Session Data Model

- add multi-session persistence model
- migrate current single workspace into a first session
- define active session lifecycle

Acceptance:

- current workspace loads as one session
- new sessions can be created and switched

### Phase 2 - Shell-Only UI Rewrite

- delete current explorer/editor/runtime layout
- add sidebar + tab-strip shell UI shell
- remove unused current UI state from `App.tsx`

Acceptance:

- only session sidebar and terminal area remain

### Phase 3 - xterm.js Integration

- replace custom terminal rendering with xterm.js
- support input, output, prompt, resize, and tab switching

Acceptance:

- active terminal behaves like a real terminal surface
- switching tabs preserves scrollback and prompt state

### Phase 4 - Multi-Terminal Sessions

- add terminal tab create/close/switch flows
- bind each tab to session-local shell state

Acceptance:

- multiple tabs can operate on the same session filesystem independently

### Phase 5 - Save / Export / Import

- add save session button
- add zip export
- add zip import as new session

Acceptance:

- exported zip round-trips into a new usable session

### Phase 6 - Session Polish

- rename sessions
- restore last active session and terminal tabs
- improve loading/error states

Acceptance:

- reloading the app restores the last active session and terminals predictably

## Technical Tasks

### App Shell Refactor

- split `App.tsx` into session shell, sidebar, terminal workspace, and session/runtime hooks
- remove legacy editor/explorer/preview UI state

### Session Persistence

- define `SessionMeta`, `SessionSnapshot`, `TerminalTabSnapshot`
- add store helpers and migration from current storage key

### Terminal Engine

- install xterm packages
- create `TerminalTabView` and `useXtermTerminal`
- implement prompt/input buffering and output replay

### Runtime Orchestration

- make active session own one `BashWorkspace`
- make active session own one `NodeboxRuntime`
- recreate runtime on session switch

### Import/Export

- add zip encode/decode helpers
- map archive paths to workspace snapshot entries
- expose file-picker and download flows

## Risks

### xterm.js Integration Risk

- React + xterm lifecycle can get messy on remount/resizes
- Mitigation: keep xterm instances behind a stable imperative wrapper per tab

### Session Switch Risk

- leaking prior Nodebox instances or terminal handlers
- Mitigation: explicit dispose/teardown path when switching sessions

### Import/Export Risk

- binary files and large trees may stress localStorage if used as backing store
- Mitigation: prefer IndexedDB if import/export lands in the same implementation pass

### Bundle Size Risk

- `just-bash`, Nodebox, xterm, and zip library together are heavy
- Mitigation: code-split session workbench/runtime-heavy modules after baseline functionality lands

## Acceptance Criteria

The redesign is successful when:

- the current frontend is replaced by a session sidebar + xterm terminal workbench
- the user can create a fresh session
- the user can save and later reopen sessions from browser storage
- the user can export a session as zip
- the user can import a zip as a new session
- the user can open multiple terminal tabs on the same session
- terminal tabs share the same filesystem but do not corrupt each other
- real shell and runtime commands still work after the UI rewrite

## Open Questions

- Should imported zip files be treated as raw project zips only, or should we define an app-specific session archive format?
- Should terminal tabs restore their exact scrollback/history across reloads, or only reopen empty tabs?
- Should users be able to rename and delete sessions in this pass, or only create/save/import/export/switch?
- Should `Save Session` be purely manual, or should we also auto-persist in the background?
