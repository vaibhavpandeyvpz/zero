import { HoomanConfig } from "hoomanjs";
import { configJsonPath } from "../lib/paths.js";

export class SessionConfig extends HoomanConfig {
  public override persist(): void {
    // Session-scoped Zero chat config is intentionally ephemeral.
  }
}

export function createSessionConfig(): SessionConfig {
  return new SessionConfig(configJsonPath());
}
