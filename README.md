# just-node

This repo is now a small pnpm monorepo centered on the core browser-terminal library, with Turbo handling workspace task orchestration.

## Workspace layout

- `packages/core` - headless terminal/workbench primitives, session models, archive helpers, just-bash integration, Nodebox runtime orchestration, and the controller used to build UIs
- `apps/example` - example React app that consumes `@just-node/core` and shows the session-first terminal workbench

## Scripts

- `pnpm dev` - run the example app through Turbo
- `pnpm build` - build the workspace through Turbo
- `pnpm lint` - lint the workspace through Turbo
- `pnpm preview` - preview the example app build

## Core package

`@just-node/core` is the main product surface. It exposes browser-first primitives for:

- session and terminal state models
- local persistence and archive import/export
- real `just-bash` file/shell execution
- real Nodebox runtime execution and file syncing
- a UI-agnostic `TerminalWorkbenchController` for building custom frontends
