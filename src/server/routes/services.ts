import type { Express } from "express";

export function registerServiceRoutes(
  app: Express,
  deps: { shutdown: (exitCode?: number) => Promise<void> },
): void {
  app.post("/api/services/restart", (_req, res) => {
    res.json({ ok: true });
    setTimeout(() => {
      void deps.shutdown(0);
    }, 100);
  });
}
