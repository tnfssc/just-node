# Introducing bash-tool for filesystem-based context retrieval

**Published:** January 7, 2026 | **Authors:** Malte Ubl, Andrew Qu

---

We open-sourced `bash-tool`, the Bash execution engine used by [our text-to-SQL agent that we recently re-architected](https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools) to reduce our token usage, improve the accuracy of the agent's responses, and improve the agent's overall performance.

[`bash-tool`](https://www.npmjs.com/package/bash-tool) gives your agent a way to find the right context by running bash-like commands over files, then returning only the results of those tool calls to the model.

Context windows can fill up quickly if you include large amounts of text into a prompt. As agents tend to do well with Unix-style workflows like `find`, `grep`, `jq`, and pipes, with `bash-tool` you can now keep large context local, in a filesystem, and let the agent use those commands to retrieve smaller slices of context on demand.

`bash-tool` provides `bash`, `readFile`, and `writeFile` tools for [AI SDK](https://ai-sdk.dev) agents, working with both in-memory and sandboxed environments, and:

- runs on top of [`just-bash`](https://justbash.dev/), which interprets bash scripts directly in TypeScript without a shell process or arbitrary binary execution
- you can preload that filesystem with your files at startup, so your agent can search them when needed without pasting everything into the prompt
- it supports running in-memory or in a custom isolated VM

**agent.ts**
```typescript
import { createBashTool } from "bash-tool";

const { tools } = await createBashTool({
  files: { "src/index.ts": "export const hello = 'world';" },
});

const agent = new ToolLoopAgent({ model, tools });
```

If you need a real shell, a real filesystem, or custom binaries, you can run the same tool against a Sandbox-compatible API for full VM isolation.

**agent.ts**
```typescript
import { createBashTool } from "bash-tool";
import { Sandbox } from "@vercel/sandbox";
const sandbox = await Sandbox.create();

const { tools } = await createBashTool({ sandbox });

const agent = new ToolLoopAgent({ model, tools });
```

**Try bash-tool in your agent**
Install the package along with AI SDK v6, and start building your file system agent.
[Get started](https://www.npmjs.com/package/bash-tool)
