import type { Express } from "express";
import type { Zero } from "../../zero.js";
import type { ChannelMode } from "../agents/channel-input.js";
import { asyncRoute } from "../middleware/async-route.js";

export function registerChannelRoutes(
  app: Express,
  deps: { zero: Zero; channelMode: ChannelMode },
): void {
  app.get("/api/channels", (_req, res) => {
    res.json({
      daemon: deps.channelMode.status(),
      servers: deps.zero.listMcpServers(),
    });
  });

  app.post(
    "/api/channels/daemon",
    asyncRoute(async (req, res) => {
      const enabled = Boolean((req.body as { enabled?: unknown }).enabled);
      res.json(await deps.channelMode.setEnabled(enabled));
    }),
  );
}
