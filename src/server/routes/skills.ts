import type { Express } from "express";
import type { Zero } from "../../zero.js";
import { routeParam } from "../http/route-param.js";
import { asyncRoute } from "../middleware/async-route.js";

export function registerSkillsRoutes(app: Express, deps: { zero: Zero }): void {
  app.get(
    "/api/skills",
    asyncRoute(async (_req, res) => {
      res.json({ skills: await deps.zero.listSkills() });
    }),
  );

  app.get(
    "/api/skills/search",
    asyncRoute(async (req, res) => {
      const query = typeof req.query.q === "string" ? req.query.q : "";
      res.json({ results: await deps.zero.searchSkills(query) });
    }),
  );

  app.post(
    "/api/skills",
    asyncRoute(async (req, res) => {
      const source = (req.body as { source?: unknown }).source;
      res.json({ skills: await deps.zero.installSkill(String(source ?? "")) });
    }),
  );

  app.delete(
    "/api/skills/:folder",
    asyncRoute(async (req, res) => {
      res.json({ skills: await deps.zero.removeSkill(routeParam(req, "folder")) });
    }),
  );
}
