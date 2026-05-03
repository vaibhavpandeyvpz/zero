import type { Express } from "express";
import type {
  ApprovalDecision,
  ChatSendRequest,
  ChatSessionMode,
} from "../../client/types.js";
import type { ChatSessions } from "../agents/chat-session.js";
import { writeNdjson } from "../http/ndjson.js";
import { routeParam } from "../http/route-param.js";
import { asyncRoute } from "../middleware/async-route.js";

export function registerChatRoutes(
  app: Express,
  deps: { chats: ChatSessions },
): void {
  app.post(
    "/api/chat/stream",
    asyncRoute(async (req, res) => {
      const body = req.body as ChatSendRequest;
      const session = deps.chats.get(body.sessionId);
      // Keep these headers for streamable HTTP/NDJSON clients.
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      await session.stream(body, (event) => writeNdjson(res, event));
      res.end();
    }),
  );

  app.post(
    "/api/chat",
    asyncRoute(async (req, res) => {
      const body = req.body as ChatSendRequest;
      const session = deps.chats.get(body.sessionId);
      res.status(410).json({
        error: "Use POST /api/chat/stream for streamable HTTP chat.",
        session: session.snapshot(),
      });
    }),
  );

  app.get("/api/chat/:sessionId", (req, res) => {
    res.json({
      session: deps.chats.get(routeParam(req, "sessionId")).snapshot(),
    });
  });

  app.post("/api/chat/:sessionId/cancel", (req, res) => {
    const session = deps.chats.get(routeParam(req, "sessionId"));
    session.cancel();
    res.json({ session: session.snapshot() });
  });

  app.post("/api/chat/:sessionId/approval", (req, res) => {
    const decision = (req.body as { decision?: ApprovalDecision }).decision;
    if (decision !== "allow" && decision !== "always" && decision !== "deny") {
      res.status(400).json({ error: "Invalid approval decision." });
      return;
    }
    const session = deps.chats.get(routeParam(req, "sessionId"));
    if (!session.approve(decision)) {
      res.status(404).json({ error: "No pending approval." });
      return;
    }
    res.json({ session: session.snapshot() });
  });

  app.post(
    "/api/chat/:sessionId/model",
    asyncRoute(async (req, res) => {
      const name = String((req.body as { name?: unknown }).name ?? "").trim();
      if (!name) {
        res.status(400).json({ error: "Model name is required." });
        return;
      }
      const session = deps.chats.get(routeParam(req, "sessionId"));
      if (session.snapshot().running) {
        res.status(409).json({
          error: "Wait for the active turn to finish before switching models.",
        });
        return;
      }
      await session.setModel(name);
      res.json({ session: session.snapshot() });
    }),
  );

  app.post("/api/chat/:sessionId/yolo", (req, res) => {
    const body = req.body as { yolo?: unknown };
    if (typeof body.yolo !== "boolean") {
      res.status(400).json({ error: 'Body must include boolean "yolo".' });
      return;
    }
    const session = deps.chats.get(routeParam(req, "sessionId"));
    session.setYolo(body.yolo);
    res.json({ session: session.snapshot() });
  });

  app.post("/api/chat/:sessionId/session-mode", (req, res) => {
    const mode = (req.body as { mode?: unknown }).mode;
    if (mode !== "default" && mode !== "plan" && mode !== "ask") {
      res.status(400).json({
        error: 'Body must include "mode": "default", "plan", or "ask".',
      });
      return;
    }
    const session = deps.chats.get(routeParam(req, "sessionId"));
    if (session.snapshot().running) {
      res.status(409).json({
        error:
          "Wait for the active turn to finish before switching session mode.",
      });
      return;
    }
    session.setSessionMode(mode as ChatSessionMode);
    res.json({ session: session.snapshot() });
  });
}
