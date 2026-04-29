import http from "node:http";
import { createRequire } from "node:module";
import process from "node:process";
import type { Request, Response } from "express";
import { Zero } from "../zero.js";
import { createServerApp } from "./app.js";
import { ChatSessions } from "./agents/chat-session.js";
import { ChannelMode } from "./agents/channel-input.js";
import { AgentWorker } from "./agents/worker.js";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "127.0.0.1";
const require = createRequire(import.meta.url);
const next = require("next") as (options: {
  dev: boolean;
  hostname: string;
  port: number;
  webpack?: boolean;
}) => {
  prepare: () => Promise<void>;
  getRequestHandler: () => (req: Request, res: Response) => Promise<void>;
};

async function main(): Promise<void> {
  const zero = new Zero();
  await zero.init();

  let server: http.Server;
  const worker = new AgentWorker();
  const chats = new ChatSessions(worker);
  const channelMode = new ChannelMode(worker);
  const nextApp = next({ dev, hostname, port, webpack: dev });
  const nextHandler = nextApp.getRequestHandler();
  await nextApp.prepare();

  async function shutdown(exitCode = 0): Promise<void> {
    await channelMode.stop();
    await chats.closeAll();
    await worker.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    process.exit(exitCode);
  }

  const app = createServerApp({
    zero,
    chats,
    channelMode,
    nextHandler,
    shutdown,
  });

  server = http.createServer(app);

  server.listen(port, hostname, () => {
    console.log(`Zero listening on http://${hostname}:${port}`);
  });

  process.on("SIGINT", () => {
    void shutdown(0);
  });
  process.on("SIGTERM", () => {
    void shutdown(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
