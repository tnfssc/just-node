# Sandpack

This folder was pulled for integration context.

- Upstream repo: `https://github.com/codesandbox/sandpack`
- Local clone: `./upstream`

For your use case, the most relevant code is the Node runtime client integration:

- `./upstream/sandpack-client/src/clients/node/index.ts`
- `./upstream/sandpack-client/src/clients/node/client.utils.ts`
- `./upstream/website/docs/src/pages/resources/faq.mdx`

These show how Sandpack:

- boots `Nodebox`
- initializes the runtime filesystem from editor files
- watches runtime FS changes and syncs them back to host state
- restarts shell/preview when needed

See `../browser-workspace/integration-notes.md` for the combined analysis with `just-bash`.
