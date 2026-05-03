import { homedir } from "node:os";
import { join } from "node:path";

const APP_FOLDER = ".zero";
const ZERO_HOME_ENV = "ZERO_HOME";

export function basePath(): string {
  const override = process.env[ZERO_HOME_ENV]?.trim();
  return override || join(homedir(), APP_FOLDER);
}

export function configJsonPath(): string {
  return join(basePath(), "config.json");
}

export function instructionsMdPath(): string {
  return join(basePath(), "instructions.md");
}

export function mcpJsonPath(): string {
  return join(basePath(), "mcp.json");
}

export function sessionsPath(): string {
  return join(basePath(), "sessions");
}

export function attachmentsPath(): string {
  return join(basePath(), "attachments");
}

export function skillsPath(): string {
  return join(basePath(), "skills");
}

export function applyHoomanHome(): void {
  process.env.HOOMAN_HOME = basePath();
}
