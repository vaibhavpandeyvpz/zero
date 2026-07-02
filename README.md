<div align="center">

# Zero

**Open-source, self-hosted web UI for your own AI agent.**

Chat with a fully local agent, wire up MCP servers and skills, connect channels, and tune every knob — all from a clean web interface you run yourself. Powered by [Hooman](https://github.com/vaibhavpandeyvpz/hooman) and built with [Next.js](https://nextjs.org/), React, and TypeScript.

[![Node](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![CI](https://github.com/vaibhavpandeyvpz/zero/actions/workflows/ci.yml/badge.svg)](https://github.com/vaibhavpandeyvpz/zero/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

<p align="center">
  <img src=".github/screenshot.png" alt="Zero app screenshot" width="1000" />
</p>

## Why Zero?

Zero is a web front-end for the [Hooman](https://github.com/vaibhavpandeyvpz/hooman) agent toolkit. You host it on your own machine or server, bring your own LLM API keys, and keep all configuration, chat history, and data on disk under your control — nothing is sent to a hosted backend.

- **Self-hosted & private** — runs as a single Node process; state lives in a local directory you own.
- **Bring your own model** — works with Anthropic, OpenAI, Azure OpenAI, Bedrock, Google, Groq, MiniMax, Moonshot, Ollama, OpenRouter, and xAI.
- **Extensible** — connect [MCP](https://modelcontextprotocol.io/) servers and install skills without touching code.
- **Open source** — MIT licensed; fork it, audit it, deploy it however you like.

## Features

- **Streaming chat** with reasoning/thinking display, file attachments, resumable sessions, and a mobile-friendly layout.
- **Tool approvals** — review and approve tool calls before they run, or enable "yolo" auto-approval when you trust the agent.
- **MCP servers** — add, edit, remove, and reload servers over `stdio` (local command), streamable HTTP, or SSE transports.
- **Skills** — list, search, install, and remove agent skills.
- **Channels** — let the agent subscribe to and respond to channel messages autonomously via a background daemon.
- **Deep configuration** from Settings: providers & credentials, named models, web search, prompts/instructions, tools, subagents, context compaction, approvals, and channels.

## Requirements

- **Node.js ≥ 24** (see `engines` in [`package.json`](package.json)).
- **API access** to at least one supported LLM provider (an API key, or a local [Ollama](https://ollama.com/) instance).

The [`hoomanjs`](https://www.npmjs.com/package/hoomanjs) runtime is installed as a normal npm dependency (see [`package.json`](package.json)); no separate install is required.

## Quick start

```bash
git clone https://github.com/vaibhavpandeyvpz/zero.git
cd zero
npm ci
npm run build
npm start
```

Then open **http://127.0.0.1:3030**.

On first run, open **Settings → Providers** to add an LLM provider and credentials, then **Settings → Models** to define a model. After that you're ready to chat.

## Configuration

### Data directory

Zero keeps all of its state in a single directory (created automatically):

- Default: `~/.zero`
- Override with the `ZERO_HOME` environment variable.

That directory holds:

| Path              | Purpose                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| `config.json`     | Agent config: providers, models, search, prompts, tools, compaction, reasoning |
| `instructions.md` | System instructions / persona editable from **Settings → Prompts**             |
| `mcp.json`        | Configured MCP servers                                                         |
| `skills/`         | Installed skills                                                               |
| `sessions/`       | Saved chat sessions                                                            |
| `attachments/`    | Uploaded chat attachments                                                      |
| `memory/`         | Agent memory, stored as JSONL files                                            |

> Zero points Hooman's `HOOMAN_HOME` at this same directory, so everything the agent reads and writes stays under `ZERO_HOME`.

### Environment variables

| Variable    | Default                                                                            | Description                              |
| ----------- | ---------------------------------------------------------------------------------- | ---------------------------------------- |
| `PORT`      | `3030` via the `dev`/`start` scripts (`3000` if you run the server entry directly) | Port to listen on                        |
| `HOST`      | `127.0.0.1`                                                                        | Interface to bind                        |
| `ZERO_HOME` | `~/.zero`                                                                          | Base directory for all Zero/Hooman state |

## Usage

The UI has two top-level areas:

- **Chat** — talk to the agent, attach files, resume previous sessions, and approve pending tool calls.
- **Settings** — everything else, organized into tabs:
  - **General** — agent name and basics
  - **Providers** — LLM provider credentials/connection details
  - **Models** — named models that reference a provider
  - **Search** — web search configuration
  - **Prompts** — edit `instructions.md`
  - **Tools** — enable/disable built-in tools
  - **Subagents** — configure delegated agents
  - **Compaction** — control conversation compaction
  - **Approvals** — manage the tool approval policy
  - **Channels** — toggle the channel daemon so the agent can handle channel messages

## Development

```bash
npm ci
npm run dev
```

`npm run dev` runs the server with `tsx` under `pm2-runtime` in development mode on **http://127.0.0.1:3030** with hot reloading via Next.js.

Useful scripts:

| Script              | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start the dev server (`PORT=3030`)                   |
| `npm run build`     | Build the Next.js app and compile the server (`tsc`) |
| `npm start`         | Run the built server (`PORT=3030`)                   |
| `npm run typecheck` | Type-check the app and server                        |

The stack is Next.js + React 19, an Express 5 API layer, Tailwind CSS with Radix/shadcn UI components, and the `hoomanjs` agent runtime.

## Deployment / hosting

Zero is a standard Node server managed by [PM2](https://pm2.keymetrics.io/) (via `pm2-runtime`), which makes it straightforward to run in containers or on a VPS.

```bash
npm ci
npm run build
# Bind to all interfaces behind a reverse proxy:
HOST=0.0.0.0 PORT=3030 npm start
```

Recommendations:

- Put Zero behind a reverse proxy (nginx, Caddy, Traefik) that terminates TLS and adds authentication — Zero has no built-in auth and binds to `127.0.0.1` by default.
- Persist the `ZERO_HOME` directory (e.g. a mounted volume) so config, sessions, and memory survive restarts.
- Provider API keys are stored in `config.json` under `ZERO_HOME`; keep that directory secure and out of version control.

## Related

Prefer a terminal-first agent with the same runtime, MCPs, skills, and channels? Check out **[Hooman](https://github.com/vaibhavpandeyvpz/hooman)** — the CLI/ACP/MCP agent toolkit Zero is built on.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening issues or pull requests.

## Security

Found a vulnerability? Please report it responsibly — see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © [Vaibhav Pandey](mailto:contact@vaibhavpandey.com)
