# Browser Workspace Research

This folder focuses on your actual goal: a persistent browser-based virtual workspace that combines:

- `just-bash` for shell-style file ops, search, pipes, `grep`, `rg`, `sed`, `awk`, file creation, etc.
- Sandpack's `Nodebox` runtime for running Node-compatible code and serving previews

## Pulled repos

- `../just-bash/upstream`
- `../sandpack-node-runtime/upstream`
- `../sandpack/upstream`

## Read first

1. `./integration-notes.md`
2. `../just-bash/README.md`
3. `../sandpack-node-runtime/README.md`

## Short answer

Yes, these two pieces can fit together, but the clean design is **not** to make one library directly own the other.

The best architecture is:

- keep a **canonical persistent file store** in the browser
- project that store into `just-bash`
- project that same store into `Nodebox`
- sync file changes both ways

The main reason is that `just-bash` and `Nodebox` expose different filesystem contracts and different runtime models.
