import type { Express, NextFunction, Request, Response } from "express";
import type multer from "multer";
import { attachmentsPath } from "../../lib/paths.js";
import { safeAttachmentName } from "../http/attachments.js";
import { routeParam } from "../http/route-param.js";

export function registerAttachmentRoutes(
  app: Express,
  deps: { attachmentUpload: multer.Multer },
): void {
  app.post(
    "/api/attachments",
    deps.attachmentUpload.array("files", 10),
    (req: Request, res: Response) => {
      const files = Array.isArray(req.files)
        ? (req.files as Express.Multer.File[])
        : [];
      res.json({
        attachments: files.map((file) => ({
          name: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        })),
      });
    },
  );

  app.get(
    "/api/attachments/:name/thumbnail",
    (req: Request, res: Response, next: NextFunction) => {
      const name = safeAttachmentName(routeParam(req, "name"));
      res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
      res.sendFile(
        name,
        { root: attachmentsPath(), dotfiles: "deny" },
        (error) => {
          if (error) next(error);
        },
      );
    },
  );
}
