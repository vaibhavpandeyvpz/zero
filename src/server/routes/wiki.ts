import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { WikiStorage } from "hoomanjs";
import type { Zero } from "../../zero.js";
import { asyncRoute } from "../middleware/async-route.js";

const ALLOWED_EXT = new Set([".pdf", ".docx"]);
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

type WikiStore = ReturnType<typeof WikiStorage.create>;

const wikiUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

function parsePage(req: Request): number {
  const raw = typeof req.query.page === "string" ? req.query.page : "1";
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parsePageSize(req: Request): number {
  const raw =
    typeof req.query.pageSize === "string" ? req.query.pageSize : "20";
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(n, 100);
}

async function withWikiStorage<T>(
  fn: (s: WikiStore) => Promise<T>,
): Promise<T> {
  const storage = WikiStorage.create();
  try {
    await storage.warmup();
    return await fn(storage);
  } finally {
    await storage.close();
  }
}

export function registerWikiRoutes(app: Express, _deps: { zero: Zero }): void {
  app.get(
    "/api/wiki/documents",
    asyncRoute(async (req, res) => {
      const page = parsePage(req);
      const pageSize = parsePageSize(req);
      const result = await withWikiStorage((s) => s.list(page, pageSize));
      res.json(result);
    }),
  );

  app.post(
    "/api/wiki/documents",
    wikiUpload.single("file"),
    asyncRoute(async (req, res) => {
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: 'Missing file field "file".' });
        return;
      }
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        res
          .status(400)
          .json({ error: "Only .pdf and .docx files are supported." });
        return;
      }
      const tmpPath = path.join(tmpdir(), `zero-wiki-${randomUUID()}${ext}`);
      await writeFile(tmpPath, file.buffer);
      try {
        const doc = await withWikiStorage((s) => s.add({ filePath: tmpPath }));
        res.status(201).json({ doc });
      } finally {
        await unlink(tmpPath).catch(() => undefined);
      }
    }),
  );

  app.delete(
    "/api/wiki/documents/:docId",
    asyncRoute(async (req, res) => {
      const raw = req.params.docId;
      const docId = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
      if (!docId) {
        res.status(400).json({ error: "Missing document id." });
        return;
      }
      const removed = await withWikiStorage((s) => s.remove(docId));
      if (!removed) {
        res.status(404).json({ error: "Document not found." });
        return;
      }
      res.status(204).end();
    }),
  );
}
