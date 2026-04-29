import { existsSync, mkdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  HoomanConfig,
  McpConfig,
  McpTransportSchema,
  createMcpConfig,
  createSkillsRegistry,
  type ConfigData,
  type McpTransport,
  type SkillListEntry,
  type SkillSearchResult,
} from "hoomanjs";
import {
  attachmentsPath,
  basePath,
  configJsonPath,
  instructionsMdPath,
  mcpJsonPath,
  sessionsPath,
  skillsPath,
  applyHoomanHome,
} from "./lib/paths.js";
import {
  DEFAULT_INSTRUCTIONS,
  maskSensitiveParamsForDisplay,
  normalizeString,
  parseJsonObject,
  transportSummary,
} from "./lib/config-utils.js";
import type {
  McpServerView,
  ZeroConfigResponse,
  ZeroPaths,
} from "./client/types.js";

const DEFAULT_AGENT_NAME = "Zero";

export class Zero {
  private readonly appConfig: HoomanConfig;
  private readonly mcpConfig: McpConfig;
  private readonly skillsRegistry: ReturnType<typeof createSkillsRegistry>;

  public constructor() {
    applyHoomanHome();
    mkdirSync(basePath(), { recursive: true });
    mkdirSync(skillsPath(), { recursive: true });
    mkdirSync(sessionsPath(), { recursive: true });
    mkdirSync(attachmentsPath(), { recursive: true });
    const configMissing = !existsSync(configJsonPath());
    this.appConfig = new HoomanConfig(configJsonPath());
    if (configMissing) {
      this.appConfig.update({ name: DEFAULT_AGENT_NAME });
    }
    this.mcpConfig = createMcpConfig(mcpJsonPath());
    this.skillsRegistry = createSkillsRegistry(basePath());
  }

  public async init(): Promise<void> {
    await Promise.all([
      mkdir(basePath(), { recursive: true }),
      mkdir(skillsPath(), { recursive: true }),
      mkdir(sessionsPath(), { recursive: true }),
      mkdir(attachmentsPath(), { recursive: true }),
    ]);
    await this.readInstructions();
  }

  public paths(): ZeroPaths {
    return {
      root: basePath(),
      config: configJsonPath(),
      instructions: instructionsMdPath(),
      mcp: mcpJsonPath(),
      skills: skillsPath(),
      sessions: sessionsPath(),
      attachments: attachmentsPath(),
    };
  }

  public async getConfig(): Promise<ZeroConfigResponse> {
    this.appConfig.reload();
    return {
      config: this.configData(),
      maskedLlmParams: maskSensitiveParamsForDisplay(this.appConfig.llm.params),
      instructions: await this.readInstructions(),
      paths: this.paths(),
    };
  }

  public async updateConfig(
    patch: Partial<ConfigData> & { instructions?: string },
  ): Promise<ZeroConfigResponse> {
    const { instructions, ...configPatch } = patch;
    if (Object.keys(configPatch).length > 0) {
      this.appConfig.update(configPatch);
    }
    if (instructions !== undefined) {
      await this.writeInstructions(instructions);
    }
    return this.getConfig();
  }

  public listMcpServers(): McpServerView[] {
    this.mcpConfig.reload();
    return this.mcpConfig.list().map((server) => ({
      ...server,
      summary: transportSummary(server.transport),
    }));
  }

  public addMcpServer(name: string, transport: McpTransport): McpServerView[] {
    this.mcpConfig.add(
      normalizeString(name, "MCP server name"),
      McpTransportSchema.parse(transport),
    );
    return this.listMcpServers();
  }

  public updateMcpServer(name: string, transport: McpTransport): McpServerView[] {
    this.mcpConfig.update(
      normalizeString(name, "MCP server name"),
      McpTransportSchema.parse(transport),
    );
    return this.listMcpServers();
  }

  public removeMcpServer(name: string): McpServerView[] {
    this.mcpConfig.remove(normalizeString(name, "MCP server name"));
    return this.listMcpServers();
  }

  public reloadMcpServers(): McpServerView[] {
    this.mcpConfig.reload();
    return this.listMcpServers();
  }

  public async listSkills(): Promise<SkillListEntry[]> {
    return this.skillsRegistry.list();
  }

  public async searchSkills(query: string): Promise<SkillSearchResult[]> {
    return this.skillsRegistry.search(query);
  }

  public async installSkill(source: string): Promise<SkillListEntry[]> {
    await this.skillsRegistry.install(normalizeString(source, "Skill source"));
    return this.listSkills();
  }

  public async removeSkill(folder: string): Promise<SkillListEntry[]> {
    await this.skillsRegistry.delete(normalizeString(folder, "Skill folder"));
    return this.listSkills();
  }

  private configData(): ConfigData {
    return {
      name: this.appConfig.name,
      llm: {
        ...this.appConfig.llm,
        params: parseJsonObject(this.appConfig.llm.params, "LLM params"),
      },
      search: this.appConfig.search,
      prompts: this.appConfig.prompts,
      tools: this.appConfig.tools,
      compaction: this.appConfig.compaction,
    };
  }

  private async readInstructions(): Promise<string> {
    try {
      return await readFile(instructionsMdPath(), "utf8");
    } catch {
      await this.writeInstructions(DEFAULT_INSTRUCTIONS);
      return DEFAULT_INSTRUCTIONS;
    }
  }

  private async writeInstructions(content: string): Promise<void> {
    const trimmed = normalizeString(content, "instructions.md");
    await mkdir(basePath(), { recursive: true });
    await writeFile(instructionsMdPath(), `${trimmed}\n`, "utf8");
  }
}
