import crypto from "node:crypto";
import { basename, extname } from "node:path";
import multer from "multer";
import { attachmentsPath } from "../../lib/paths.js";

function safeExtension(filename: string): string {
  const extension = extname(filename).toLowerCase();
  return /^[a-z0-9.]+$/.test(extension) ? extension : "";
}

export function safeAttachmentName(value: string): string {
  if (!value || basename(value) !== value) {
    throw new Error("Invalid attachment name.");
  }
  return value;
}

export function createAttachmentUpload() {
  return multer({
    storage: multer.diskStorage({
      destination: attachmentsPath(),
      filename: (_req, file, callback) => {
        callback(null, `${crypto.randomUUID()}${safeExtension(file.originalname)}`);
      },
    }),
    limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  });
}
