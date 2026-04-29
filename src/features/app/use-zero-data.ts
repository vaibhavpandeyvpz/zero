import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getConfig,
  getHealth,
  listMcp,
  listSkills,
  setDaemonMode,
} from "@/client/api";
import type {
  HealthResponse,
  McpServerView,
  SkillsResponse,
  ZeroConfigResponse,
} from "@/client/types";

export function useZeroData(options: {
  running: boolean;
  queued: boolean;
  pendingApproval: boolean;
}) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [config, setConfig] = useState<ZeroConfigResponse | null>(null);
  const [mcp, setMcp] = useState<McpServerView[]>([]);
  const [skills, setSkills] = useState<SkillsResponse["skills"]>([]);
  const [busy, setBusy] = useState(false);

  async function refreshAll() {
    const [nextHealth, nextConfig, nextMcp, nextSkills] = await Promise.all([
      getHealth(),
      getConfig(),
      listMcp(),
      listSkills().catch(() => ({ skills: [] })),
    ]);
    setHealth(nextHealth);
    setConfig(nextConfig);
    setMcp(nextMcp.servers);
    setSkills(nextSkills.skills);
  }

  useEffect(() => {
    void refreshAll().catch((error) =>
      toast.error((error as Error).message),
    );
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void getHealth().then(setHealth).catch(() => undefined);
    }, options.running || options.queued || options.pendingApproval ? 1000 : 3000);
    return () => clearInterval(timer);
  }, [options.pendingApproval, options.queued, options.running]);

  async function toggleDaemon(enabled: boolean) {
    const status = await setDaemonMode(enabled);
    setHealth((prev) =>
      prev
        ? { ...prev, daemonEnabled: status.enabled, daemonStatus: status }
        : prev,
    );
  }

  return {
    health,
    config,
    mcp,
    skills,
    busy,
    setBusy,
    setConfig,
    setMcp,
    setSkills,
    refreshAll,
    toggleDaemon,
  };
}
