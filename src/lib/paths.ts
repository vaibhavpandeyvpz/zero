import { homedir } from "node:os";
import { join } from "node:path";
import { projectPath } from "hoomanjs";

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

/**
 * Sessions live under hoomanjs's project-scoped storage (keyed off the
 * server process's cwd/git-root, see hoomanjs's project-registry) so Zero's
 * own transcript store stays colocated with the agent's own session
 * snapshots for the same session id.
 */
export function sessionsPath(): string {
  return join(projectPath(), "sessions");
}

export function attachmentsPath(): string {
  return join(projectPath(), "attachments");
}

export function skillsPath(): string {
  return join(basePath(), "skills");
}

export function applyHoomanHome(): void {
  process.env.HOOMAN_HOME = basePath();
}
