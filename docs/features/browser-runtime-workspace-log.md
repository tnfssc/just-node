# Browser Runtime Workspace Living Log

## Objective

- Feature or task objective: Replace the simulated prototype with a real in-browser `just-bash` + `@codesandbox/nodebox` workspace and terminal.
- Success criteria: Terminal commands execute through `just-bash`, Node/npm commands execute through Nodebox, preview comes from a real browser runtime, and workspace state persists across reloads.

## Scope and Constraints

- In scope: Real browser shell integration, real browser Node runtime integration, workspace persistence, terminal UX, runtime log/preview wiring.
- Out of scope: Perfect npm parity, native addon support, full Linux compatibility, production-grade multi-workspace management.
- Constraints (technical/product/time): `just-bash` resets shell state on each `exec()`, Nodebox requires an iframe/runtime connection and has browser runtime limits, repo started from a plain Vite app.

## Baseline Context

- Starting behavior: The app was converted into a simulated prototype with local state, fake shell commands, and fake runtime actions.
- Known issues: This does not satisfy the actual product goal of running a real browser bash + npm/node environment.
- Relevant starting files:
  - `/Users/sharath/Private/home/Code/just-node/vite-project/src/App.tsx`
  - `/Users/sharath/Private/home/Code/just-node/vite-project/src/App.css`
  - `/Users/sharath/Private/home/Code/just-node/vite-project/src/index.css`
  - `/Users/sharath/Private/home/Code/just-node/vite-project/.docs/browser-workspace/integration-notes.md`
  - `/Users/sharath/Private/home/Code/just-node/vite-project/.plans/browser-persistent-workspace/plan.md`

## Decision Log

| Date | Decision | Why | Impact |
| --- | --- | --- | --- |
| 2026-03-22 | Rebuild around real `just-bash` + Nodebox instead of extending the simulation. | User clarified the real goal is a functioning browser shell/runtime, not a mock workflow. | Existing prototype state/command logic will be replaced by service-backed integration. |
| 2026-03-22 | Treat `npm run <script>` as package-script resolution plus direct Nodebox shell execution, not as a literal `npm` binary call. | The installed Nodebox runtime did not expose an `npm` executable, but package scripts are still runnable by parsing `package.json` and executing the underlying command. | `npm install`/`uninstall` remain a real shim over `package.json`, while `npm run` starts actual browser runtime processes. |
| 2026-03-22 | Exclude derived dependency directories from the canonical persisted workspace. | Runtime-generated `node_modules` inflated the explorer and local persistence after dependency resolution. | The browser workspace persists source files and project metadata, while runtime dependency trees remain derived/runtime-side state. |
| 2026-03-22 | Emulate inline `node -e` by materializing a temporary runtime file inside a derived workspace folder. | Direct inline `node -e` execution through this Nodebox path failed, but file-based `node <file>` execution works reliably. | Inline eval now behaves for terminal users without polluting the visible workspace; `node -c` returns explicit guidance because it does not execute code. |

## Progress Log

### 2026-03-22 06:12 - Reframed implementation target

- Change: Stopped treating the prototype as the deliverable and switched to a real integration plan.
- Why: The user explicitly called out that simulation is not acceptable for this product goal.
- Files: `/Users/sharath/Private/home/Code/just-node/vite-project/docs/features/browser-runtime-workspace-log.md`
- Validation: Re-read the local architecture and upstream integration docs for `just-bash` and Nodebox.
- Next: Install the real dependencies, design the service split, and replace simulated command/runtime logic.

### 2026-03-22 06:25 - Installed runtime dependencies and replaced the simulation

- Change: Added real `just-bash` and `@codesandbox/nodebox` dependencies, then rewrote the app around a real bash-backed workspace service, a Nodebox runtime service, and a persistent browser snapshot model.
- Why: The product goal is a working browser terminal/runtime, so the UI had to become a projection of real services instead of local mock state.
- Files: `/Users/sharath/Private/home/Code/just-node/vite-project/package.json`, `/Users/sharath/Private/home/Code/just-node/vite-project/pnpm-lock.yaml`, `/Users/sharath/Private/home/Code/just-node/vite-project/src/App.tsx`, `/Users/sharath/Private/home/Code/just-node/vite-project/src/lib/workspace.ts`, `/Users/sharath/Private/home/Code/just-node/vite-project/src/lib/bashWorkspace.ts`, `/Users/sharath/Private/home/Code/just-node/vite-project/src/lib/nodeboxRuntime.ts`
- Validation: `pnpm add just-bash @codesandbox/nodebox`, `npm run build`, `npm run lint`
- Next: Validate real bash commands, runtime process boot, preview URLs, and persistence behavior in Chrome DevTools.

### 2026-03-22 06:36 - Verified the real browser loop and trimmed derived runtime state

- Change: Verified real `pwd`, file creation, package mutation, script execution, and live preview in the browser; then filtered runtime-generated dependency trees from persisted workspace state and the explorer surface.
- Why: Nodebox successfully ran the preview server, but syncing `node_modules` back into the canonical workspace made the IDE surface unusable and bloated persistence.
- Files: `/Users/sharath/Private/home/Code/just-node/vite-project/src/App.tsx`, `/Users/sharath/Private/home/Code/just-node/vite-project/src/lib/workspace.ts`, `/Users/sharath/Private/home/Code/just-node/vite-project/src/lib/bashWorkspace.ts`, `/Users/sharath/Private/home/Code/just-node/vite-project/src/lib/nodeboxRuntime.ts`
- Validation: Chrome DevTools manual flow: `pwd`, `echo hello > notes.txt`, `npm run dev`, preview interaction, `npm install lodash`, reload persistence, mobile viewport check.
- Next: Consider richer terminal session persistence (`export`, advanced shell state), preview restart UX, and IndexedDB migration for larger workspaces.

### 2026-03-22 06:49 - Fixed inline node command behavior

- Change: Added explicit handling for `node -e` by writing the inline script into a hidden derived runtime folder and running it as a real Nodebox file entry; added a targeted message for `node -c` explaining that it only checks syntax and does not execute code.
- Why: A user-reported inline node command did not surface terminal output, and direct inline eval through the current Nodebox path errored while file execution worked.
- Files: `/Users/sharath/Private/home/Code/just-node/vite-project/src/App.tsx`, `/Users/sharath/Private/home/Code/just-node/vite-project/src/lib/workspace.ts`
- Validation: Chrome DevTools run of `node -e "console.log('hey')"`; first pass exposed absolute/relative Nodebox path issues, then the runtime path mapping was corrected to emit script-relative paths for nested files.
- Next: Add more Node CLI compatibility shims only where real user workflows prove they are needed.

## Open Items

- [x] Replace simulated shell execution in `/Users/sharath/Private/home/Code/just-node/vite-project/src/App.tsx` with a real `just-bash` service.
- [x] Add a real Nodebox runtime iframe/preview pipeline.
- [x] Persist workspace files and terminal session state from the real FS/runtime.
- [ ] Move persistence from localStorage to IndexedDB for larger real projects.
- [ ] Expand shell session persistence beyond basic cwd/history/export handling.

## Risks and Mitigations

- Risk: Nodebox preview/runtime may have browser/network constraints during local validation.
  - Mitigation: Follow upstream single-instance + iframe setup exactly and validate with Chrome DevTools after each milestone.

## Verification Log

- Command/check: Local doc/API review for `just-bash` browser entry and Nodebox API.
  - Result: Confirmed viable browser imports and required methods for FS/shell/preview integration.
  - Notes: `just-bash` should own the editable shell FS; Nodebox should be the runtime projection.
- Command/check: `pnpm add just-bash @codesandbox/nodebox`
  - Result: Installed successfully after `npm install` hit dependency-resolution conflicts.
  - Notes: Existing repo tooling is pnpm-friendly, so the integration follows that path.
- Command/check: `npm run build`
  - Result: Passes.
  - Notes: Vite warns that `just-bash` browser bundle externally references `node:zlib`, which is only relevant to unsupported gzip commands in browsers.
- Command/check: `npm run lint`
  - Result: Passes.
  - Notes: `.docs` remains ignored so lint reflects the app code.
- Command/check: Chrome DevTools manual validation
  - Result: Real `just-bash` commands executed, Nodebox connected, `npm run dev` resolved to `node server.js`, preview URL loaded, preview UI responded, `npm install lodash` updated `/workspace/package.json`, reload restored source workspace state.
  - Notes: Runtime-generated dependency trees are excluded from canonical persistence/explorer state.
- Command/check: Chrome DevTools `node -e "console.log('hey')"`
  - Result: Initial direct inline eval path failed in Nodebox, then succeeded after translating inline code to a temporary runtime file.
  - Notes: `node -c` remains non-executing by design and now returns an explicit terminal hint.

## Handoff Snapshot

- Current status: Real browser workspace loop is implemented and validated end-to-end.
- Key decisions and rationale: Use a canonical persistent workspace projected into both `just-bash` and Nodebox; resolve `npm run` by parsing package scripts and executing the real underlying command in Nodebox; keep runtime-generated dependencies out of canonical persistence.
- Critical paths:
  - `/Users/sharath/Private/home/Code/just-node/vite-project/src/App.tsx`
  - `/Users/sharath/Private/home/Code/just-node/vite-project/src/lib/workspace.ts`
  - `/Users/sharath/Private/home/Code/just-node/vite-project/src/lib/bashWorkspace.ts`
  - `/Users/sharath/Private/home/Code/just-node/vite-project/src/lib/nodeboxRuntime.ts`
  - `/Users/sharath/Private/home/Code/just-node/vite-project/.docs/browser-workspace/integration-notes.md`
  - `/Users/sharath/Private/home/Code/just-node/vite-project/.docs/just-bash/upstream/README.md`
  - `/Users/sharath/Private/home/Code/just-node/vite-project/.docs/sandpack-node-runtime/upstream/packages/nodebox/README.md`
- Remaining work: IndexedDB persistence, broader shell-session parity, stronger runtime recovery/restart ergonomics, and potentially vendoring/forking upstreams if package-level integration becomes too constraining.
- Known blockers: None for the current validated loop.
