# Session Shell Workbench Tickets

Status key:

- `todo`
- `in_progress`
- `blocked`
- `done`

Priority key:

- `P0` required for first usable redesign
- `P1` strong follow-up for usability
- `P2` polish or optional scope

## Epic 1 - Session Model and Persistence

### Ticket 1.1 - Define session domain types

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - `SessionMeta`
  - `SessionSnapshot`
  - `TerminalTabSnapshot`
  - migration shape from current single-workspace state

### Ticket 1.2 - Implement session store

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - create/list/load/save session APIs
  - last active session tracking
  - current-workspace migration into first session

### Ticket 1.3 - Decide and implement storage backend

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - backend choice finalized (`localStorage` or IndexedDB)
  - persistence adapter

## Epic 2 - UI Rewrite

### Ticket 2.1 - Remove current IDE layout

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - delete explorer/editor/preview-first layout
  - simplify app shell to sidebar + main tabbed terminal area

### Ticket 2.2 - Build session sidebar

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - session list
  - active state
  - new/save/export/import actions

### Ticket 2.3 - Build terminal tab strip

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - tab creation
  - tab switching
  - tab close behavior

## Epic 3 - xterm.js Integration

### Ticket 3.1 - Install and wire xterm.js

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - `xterm`
  - fit addon
  - reusable terminal host component

### Ticket 3.2 - Implement prompt/input/output bridge

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - input capture
  - output streaming
  - prompt redraw
  - clear/tab replay behavior

### Ticket 3.3 - Preserve per-tab terminal state

- Status: `todo`
- Priority: `P1`
- Deliverables:
  - per-tab scrollback
  - command history
  - cwd/env state policy

## Epic 4 - Session Runtime Container

### Ticket 4.1 - Make runtime state session-scoped

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - one `BashWorkspace` per active session
  - one `NodeboxRuntime` per active session

### Ticket 4.2 - Handle session switching teardown/hydration

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - dispose active runtime resources
  - hydrate next session cleanly

### Ticket 4.3 - Support multiple terminal tabs on same session

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - shared filesystem
  - independent terminal controllers

## Epic 5 - Save / Import / Export

### Ticket 5.1 - Save current session into browser storage

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - manual save action
  - updated timestamps/metadata

### Ticket 5.2 - Export session as zip

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - zip serializer
  - browser download flow

### Ticket 5.3 - Import zip as new session

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - file picker flow
  - zip parser
  - new-session creation from imported contents

## Epic 6 - Validation and Polish

### Ticket 6.1 - Validate terminal behavior with Chrome DevTools

- Status: `todo`
- Priority: `P0`
- Deliverables:
  - session creation flow validation
  - tab behavior validation
  - import/export validation

### Ticket 6.2 - Improve responsive layout

- Status: `todo`
- Priority: `P1`
- Deliverables:
  - narrow-width sidebar behavior
  - usable tab strip on smaller screens

### Ticket 6.3 - Add session management polish

- Status: `todo`
- Priority: `P1`
- Deliverables:
  - rename/delete sessions if included in scope
  - improved empty/loading/error states
