# Announcing Sandpack 2.0 and a Node.js runtime for any browser

Source: `https://codesandbox.io/blog/announcing-sandpack-2`

Published: February 16, 2023

## Key points

- Sandpack 2.0 introduced `Nodebox`, a fast Node.js-compatible runtime that runs in the browser.
- Nodebox is meant to let Sandpack run server-side code and Node-oriented projects, not just client-side browser apps.
- The stated goal is application compatibility rather than full Node.js feature parity.
- CodeSandbox highlights support for templates like Node, Next.js, Vite, Astro, React, Vue, and Svelte.
- The article notes important limitations: no native addons (`napi`), no low-level C++/Rust packages, and no raw socket support for databases like Postgres, MongoDB, or MySQL.
- It positions Nodebox against WebContainers by emphasizing broader browser compatibility and fewer deployment requirements, while accepting some API limitations in exchange.

## Useful excerpt

"Nodebox is a high-level abstraction of Node.js... Nodebox aims for application compatibility, not Node.js feature parity."

## Why this matters

This announcement is the clearest official explanation of what the runtime is trying to do, its intended scope, and the tradeoffs behind the implementation.
