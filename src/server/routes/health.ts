import type { Express } from "express";
import type { Zero } from "../../zero.js";
import type { ChannelMode } from "../agents/channel-input.js";

export function registerHealthRoutes(
  app: Express,
  deps: { zero: Zero; channelMode: ChannelMode },
): void {
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      name: "Zero",
      version: "0.1.0",
      daemonEnabled: deps.channelMode.status().enabled,
      daemonStatus: deps.channelMode.status(),
      paths: deps.zero.paths(),
    });
  });
}
