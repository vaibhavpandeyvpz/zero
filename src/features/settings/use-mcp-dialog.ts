import { useState } from "react";
import type { McpServerView } from "@/client/types";
import {
  entriesToStringMap,
  formatMcpCommandLine,
  parseMcpCommandLine,
  stringMapToEntries,
  type KeyValueEntry,
} from "./form-utils";

export type McpTransportDraft = McpServerView["transport"];
export type McpTransportType = McpTransportDraft["type"];

export function useMcpDialog() {
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false);
  const [mcpName, setMcpName] = useState("");
  const [mcpEditingName, setMcpEditingName] = useState<string | null>(null);
  const [mcpType, setMcpType] = useState<McpTransportType>("stdio");
  const [mcpCommand, setMcpCommand] = useState("");
  const [mcpEnvEntries, setMcpEnvEntries] = useState<KeyValueEntry[]>([]);
  const [mcpCwd, setMcpCwd] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpHeaderEntries, setMcpHeaderEntries] = useState<KeyValueEntry[]>([]);

  function resetMcpForm() {
    setMcpName("");
    setMcpEditingName(null);
    setMcpType("stdio");
    setMcpCommand("");
    setMcpEnvEntries([]);
    setMcpCwd("");
    setMcpUrl("");
    setMcpHeaderEntries([]);
  }

  function startAddMcpServer() {
    resetMcpForm();
    setMcpDialogOpen(true);
  }

  function editMcpServer(server: McpServerView) {
    setMcpEditingName(server.name);
    setMcpName(server.name);
    setMcpType(server.transport.type);
    setMcpCommand(
      server.transport.type === "stdio"
        ? formatMcpCommandLine(server.transport.command, server.transport.args)
        : "",
    );
    setMcpEnvEntries(
      server.transport.type === "stdio"
        ? stringMapToEntries(server.transport.env)
        : [],
    );
    setMcpCwd(
      server.transport.type === "stdio" ? (server.transport.cwd ?? "") : "",
    );
    setMcpUrl(server.transport.type === "stdio" ? "" : server.transport.url);
    setMcpHeaderEntries(
      server.transport.type === "stdio"
        ? []
        : stringMapToEntries(server.transport.headers),
    );
    setMcpDialogOpen(true);
  }

  function buildMcpTransport(): McpTransportDraft {
    if (mcpType === "stdio") {
      const { command, args } = parseMcpCommandLine(mcpCommand);
      return {
        type: "stdio",
        command,
        args,
        env: entriesToStringMap(mcpEnvEntries, "Environment"),
        cwd: mcpCwd.trim() || undefined,
      };
    }

    return {
      type: mcpType,
      url: mcpUrl,
      headers: entriesToStringMap(mcpHeaderEntries, "Headers"),
    };
  }

  return {
    mcpDialogOpen,
    mcpName,
    mcpEditingName,
    mcpType,
    mcpCommand,
    mcpEnvEntries,
    mcpCwd,
    mcpUrl,
    mcpHeaderEntries,
    setMcpDialogOpen,
    setMcpName,
    setMcpType,
    setMcpCommand,
    setMcpEnvEntries,
    setMcpCwd,
    setMcpUrl,
    setMcpHeaderEntries,
    resetMcpForm,
    startAddMcpServer,
    editMcpServer,
    buildMcpTransport,
  };
}
