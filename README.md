<div align="center">

# Zero

Web UI for **Hooman**: chat with your agent, manage MCP servers and skills, and tune configuration—built with [Next.js](https://nextjs.org/), React, and TypeScript.

[![Node](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![CI](https://github.com/vaibhavpandeyvpz/zero/actions/workflows/ci.yml/badge.svg)](https://github.com/vaibhavpandeyvpz/zero/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

<p align="center">
  <img src=".github/screenshot.png" alt="Zero app screenshot" width="1000" />
</p>

## Related

**Want the terminal-first agent** with same multi-channel runtime, MCPs, skills, local coding agent? Use [**Hooman**](https://github.com/vaibhavpandeyvpz/hooman) — [README](https://github.com/vaibhavpandeyvpz/hooman#readme).

## Requirements

- **Node.js** ≥ 24 (see `engines` in [`package.json`](package.json))
- **hoomanjs** pinned in [`package.json`](package.json) (e.g. `^1.26.3`); Settings → LLM providers follow Hooman’s `LlmProvider` list, including **TensorZero** for a TensorZero gateway OpenAI-compatible endpoint.

## Quick start

```bash
npm ci
npm run build
npm start
```

With `npm run dev` / `npm start`, listen on **http://127.0.0.1:3030** (`PORT=3030` in those scripts). If you run the server entry without `PORT`, the fallback in code is **3000**. Override with `PORT` and `HOST` as needed.

Adjust scripts for developer v/s deployment (see [`package.json`](package.json) `dev` / `start`).

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening issues or pull requests.

## Security

Report security issues responsibly—see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © [Vaibhav Pandey](mailto:contact@vaibhavpandey.com)
