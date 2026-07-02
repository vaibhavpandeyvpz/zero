import type { Express } from "express";
import { getAllowlist } from "hoomanjs";
import { asyncRoute } from "../middleware/async-route.js";

/**
 * Persisted "always allow" tool rules (disk-backed `Allowlist`, new in
 * hoomanjs 1.3x — replaces the old per-session in-memory allowlist).
 */
export function registerApprovalRoutes(app: Express): void {
  app.get(
    "/api/approvals/allowlist",
    asyncRoute(async (_req, res) => {
      res.json({ rules: getAllowlist().rules() });
    }),
  );

  app.delete(
    "/api/approvals/allowlist",
    asyncRoute(async (req, res) => {
      const body = req.body as { tool?: unknown; pattern?: unknown };
      const tool = typeof body.tool === "string" ? body.tool : "";
      const pattern = typeof body.pattern === "string" ? body.pattern : "";
      if (!tool || !pattern) {
        res.status(400).json({ error: "Missing tool or pattern." });
        return;
      }
      getAllowlist().removeRule(tool, pattern);
      res.json({ rules: getAllowlist().rules() });
    }),
  );

  app.delete(
    "/api/approvals/allowlist/all",
    asyncRoute(async (_req, res) => {
      getAllowlist().clear();
      res.json({ rules: getAllowlist().rules() });
    }),
  );
}
