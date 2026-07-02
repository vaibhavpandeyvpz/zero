# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project overview

Zero is an open-source, self-hosted web UI for the [Hooman](https://github.com/vaibhavpandeyvpz/hooman) AI agent
toolkit. It's a single Node.js process combining:

- A **Next.js 16 (App Router) + React 19 + TypeScript** front end for chat and settings.
- An **Express 5** API layer mounted alongside the Next.js request handler in one HTTP server.
- The **`hoomanjs`** npm package as the agent runtime (config, providers, models, MCP, skills, channels).

All state (config, sessions, memory, attachments, skills) lives on disk under `ZERO_HOME` (default `~/.zero`), not in
a database or hosted backend.

## Repository layout

```
src/
  app/                Next.js App Router: layout.tsx, page.tsx, globals.css
  client/             Browser-side API client (api.ts) and shared client/server types (types.ts)
  components/
    layout/           App shell components (e.g. ZeroShell.tsx)
    ui/                shadcn/Radix-based primitives (button, dialog, tabs, etc.)
  features/
    app/               App-level data hooks (use-zero-data.ts)
    chat/              Chat panel, session state/switching, attachments, autoscroll/textarea hooks
    settings/          Settings forms: config labels, provider/model helpers, MCP + skill install dialogs
  lib/                 Shared utilities: config-utils.ts, paths.ts (ZERO_HOME path helpers), utils.ts
  server/
    api.ts             Server entrypoint: boots Zero, Next.js, Express, HTTP server, graceful shutdown
    app.ts             Express app wiring (routes, middleware, Next.js handler passthrough)
    agents/            Agent runtime glue: worker, chat-session, channel-input/message, approval, stream events
    http/              Low-level HTTP helpers (attachments, ndjson streaming, route params)
    middleware/        Express middleware (async-route wrapper, error handler)
    routes/            Express route handlers: chat, config, mcp, skills, approvals, attachments, channels, health, services
    approval.ts, channel-mode.ts, chat-session.ts, chat-transcript-store.ts, session-config.ts
  theme/               ThemeProvider and design tokens
  zero.ts              Zero class: core app logic bridging hoomanjs (HoomanConfig, McpConfig, skills registry)
components.json        shadcn UI config
next.config.ts         Next.js config
tsconfig.json           Client/app TypeScript config (bundler resolution, path alias @/* -> src/*)
tsconfig.server.json    Server-only TypeScript config (NodeNext, emits to dist/), extends tsconfig.json
```

## Build and run commands

```bash
npm ci                # install dependencies (Node >= 24 required, see package.json engines)
npm run dev            # dev server on http://127.0.0.1:3030, via tsx + pm2-runtime, hot reload
npm run build          # next build, then tsc -p tsconfig.server.json (compiles src/server + src/lib to dist/)
npm start              # production: pm2-runtime runs dist/server/api.js on PORT 3030
npm run typecheck      # tsc --noEmit (app) + tsc -p tsconfig.server.json --noEmit (server)
```

Notes:

- `dev`/`start` both run under `pm2-runtime`, so the process is managed by PM2 even locally.
- The entrypoint is `src/server/api.ts` (dev, via `tsx`) / `dist/server/api.js` (prod, after build).
- `tsconfig.server.json` only includes `src/server/**`, `src/lib/**`, `src/zero-hc.ts`, and
  `src/client/types.ts` — it excludes `src/app`, `src/components`, `src/theme` (those are Next.js/client-only).
- Environment variables: `PORT` (default 3030 via scripts, 3000 if running the entry directly), `HOST`
  (default `127.0.0.1`), `ZERO_HOME` (default `~/.zero`, base dir for all Zero/Hooman state).

## Testing and verification

There is no dedicated test suite/framework in this repo. Verification is via type checking and build:

```bash
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs exactly these two steps (`npm ci`, `npm run typecheck`, `npm run build`) on
Node 24 for pushes/PRs to `main`/`master`. Run both locally before opening a PR — this mirrors CONTRIBUTING.md's
guidance.

## Code style / conventions

- TypeScript, strict mode, ES modules (`"type": "module"` in package.json). Use the `@/*` path alias
  (maps to `./src/*`) in app/client code; server-only code under `src/server`/`src/lib` uses relative imports
  with explicit `.js` extensions (NodeNext resolution — see existing files like `src/zero.ts`, `src/server/api.ts`).
- UI: Tailwind CSS v4 + Radix UI primitives wrapped as shadcn-style components in `src/components/ui`. New UI
  primitives should follow the existing `class-variance-authority` + `clsx`/`tailwind-merge` pattern used there.
- Feature code lives under `src/features/<area>` (e.g. `chat`, `settings`, `app`), grouped by concern rather than
  by component type; hooks are named `use-*.ts`.
- Server routes live under `src/server/routes/<name>.ts`, one file per resource, wired into the Express app in
  `src/server/app.ts`. Async route handlers use the `middleware/async-route.ts` wrapper; errors go through
  `middleware/error-handler.ts`.
- `src/zero.ts` (`Zero` class) is the core bridge to `hoomanjs` (config, MCP servers, skills registry) — most
  server-side business logic should go through or alongside this class rather than duplicating hoomanjs calls.
- Path helpers for `ZERO_HOME`-relative locations live in `src/lib/paths.ts`; use them instead of hardcoding paths.

## Security / operational notes

- Zero has **no built-in authentication** and binds to `127.0.0.1` by default. Any change that affects binding,
  auth, or exposure should be called out explicitly; production deployments are expected to sit behind a reverse
  proxy that adds TLS + auth.
- Provider API keys and credentials are stored in `config.json` under `ZERO_HOME` (default `~/.zero`). Never log,
  print, or commit contents of `ZERO_HOME` (config.json, mcp.json, sessions/, memory/, attachments/).
  `src/lib/config-utils.ts` has `maskSensitiveParamsForDisplay` for redacting secrets before sending to the client —
  use it when exposing provider/model config data.
- `.next/`, `dist/`, `tsconfig*.tsbuildinfo`, and `node_modules/` are build artifacts — don't hand-edit or commit
  changes inside them.
