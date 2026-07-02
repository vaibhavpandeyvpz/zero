import type { Express } from "express";
import type { Zero } from "../../zero.js";
import type { McpUpsertRequest } from "../../client/types.js";
import { routeParam } from "../http/route-param.js";
import type { AgentWorker } from "../agent-worker.js";
import { asyncRoute } from "../middleware/async-route.js";

export function registerMcpRoutes(
  app: Express,
  deps: { zero: Zero; worker: AgentWorker },
): void {
  app.get("/api/mcp", (_req, res) => {
    res.json({ servers: deps.zero.listMcpServers() });
  });

  app.post("/api/mcp/reload", (_req, res) => {
    res.json({ servers: deps.zero.reloadMcpServers() });
  });

  app.post("/api/mcp", (req, res) => {
    const body = req.body as McpUpsertRequest;
    res.json({ servers: deps.zero.addMcpServer(body.name, body.transport) });
  });

  app.patch("/api/mcp/:name", (req, res) => {
    const body = req.body as Partial<McpUpsertRequest>;
    if (!body.transport) {
      res.status(400).json({ error: "Missing MCP transport." });
      return;
    }
    res.json({
      servers: deps.zero.updateMcpServer(
        routeParam(req, "name"),
        body.transport,
      ),
    });
  });

  app.delete("/api/mcp/:name", (req, res) => {
    res.json({ servers: deps.zero.removeMcpServer(routeParam(req, "name")) });
  });

  // OAuth for remote (streamable-http / sse) MCP servers — new in hoomanjs 1.3x.
  app.get(
    "/api/mcp/auth-status",
    asyncRoute(async (_req, res) => {
      const manager = await deps.worker.getMcpManager();
      res.json({ statuses: await manager.listAuthStatuses() });
    }),
  );

  app.post(
    "/api/mcp/:name/authenticate",
    asyncRoute(async (req, res) => {
      const manager = await deps.worker.getMcpManager();
      await manager.authenticate(routeParam(req, "name"));
      res.json({ statuses: await manager.listAuthStatuses() });
    }),
  );

  app.post(
    "/api/mcp/:name/logout",
    asyncRoute(async (req, res) => {
      const manager = await deps.worker.getMcpManager();
      await manager.logout(routeParam(req, "name"));
      res.json({ statuses: await manager.listAuthStatuses() });
    }),
  );
}
