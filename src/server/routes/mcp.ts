import type { Express } from "express";
import type { Zero } from "../../zero.js";
import type { McpUpsertRequest } from "../../client/types.js";
import { routeParam } from "../http/route-param.js";

export function registerMcpRoutes(app: Express, deps: { zero: Zero }): void {
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
      servers: deps.zero.updateMcpServer(routeParam(req, "name"), body.transport),
    });
  });

  app.delete("/api/mcp/:name", (req, res) => {
    res.json({ servers: deps.zero.removeMcpServer(routeParam(req, "name")) });
  });
}
