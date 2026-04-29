import type { Response } from "express";

export function writeNdjson(res: Response, value: unknown): void {
  res.write(`${JSON.stringify(value)}\n`);
}
