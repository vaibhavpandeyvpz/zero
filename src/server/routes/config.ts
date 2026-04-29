import type { Express } from "express";
import type { Zero } from "../../zero.js";
import { asyncRoute } from "../middleware/async-route.js";

export function registerConfigRoutes(app: Express, deps: { zero: Zero }): void {
  app.get(
    "/api/config",
    asyncRoute(async (_req, res) => {
      res.json(await deps.zero.getConfig());
    }),
  );

  app.patch(
    "/api/config",
    asyncRoute(async (req, res) => {
      res.json(await deps.zero.updateConfig(req.body));
    }),
  );
}
