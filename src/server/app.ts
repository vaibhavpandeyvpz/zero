import express, { type Request, type Response } from "express";
import type { Zero } from "../zero.js";
import type { ChatSessions } from "./agents/chat-session.js";
import type { ChannelMode } from "./agents/channel-input.js";
import { createAttachmentUpload } from "./http/attachments.js";
import { errorHandler } from "./middleware/error-handler.js";
import { registerAttachmentRoutes } from "./routes/attachments.js";
import { registerChannelRoutes } from "./routes/channels.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerConfigRoutes } from "./routes/config.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMcpRoutes } from "./routes/mcp.js";
import { registerServiceRoutes } from "./routes/services.js";
import { registerSkillsRoutes } from "./routes/skills.js";

export type NextRequestHandler = (req: Request, res: Response) => Promise<void>;

export function createServerApp(deps: {
  zero: Zero;
  chats: ChatSessions;
  channelMode: ChannelMode;
  nextHandler: NextRequestHandler;
  shutdown: (exitCode?: number) => Promise<void>;
}) {
  const app = express();

  app.use(express.json({ limit: "5mb" }));

  registerHealthRoutes(app, deps);
  registerConfigRoutes(app, deps);
  registerMcpRoutes(app, deps);
  registerSkillsRoutes(app, deps);
  registerChannelRoutes(app, deps);
  registerAttachmentRoutes(app, { attachmentUpload: createAttachmentUpload() });
  registerChatRoutes(app, deps);
  registerServiceRoutes(app, deps);

  app.all(/.*/, (req, res) => deps.nextHandler(req, res));
  app.use(errorHandler);

  return app;
}
