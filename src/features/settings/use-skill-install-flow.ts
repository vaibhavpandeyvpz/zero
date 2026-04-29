import { useState } from "react";
import { toast } from "sonner";
import type { SkillSearchResult } from "hoomanjs";
import type { SkillInstallCandidate } from "./form-utils";

export function useSkillInstallFlow(options: {
  setSkillResults: (results: SkillSearchResult[]) => void;
}) {
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [skillInstallCandidate, setSkillInstallCandidate] =
    useState<SkillInstallCandidate | null>(null);
  const [skillQuery, setSkillQuery] = useState("");
  const [skillSource, setSkillSource] = useState("");

  function clearSkillInstallState() {
    setSkillDialogOpen(false);
    setSkillInstallCandidate(null);
    setSkillSource("");
    setSkillQuery("");
    options.setSkillResults([]);
  }

  function requestSkillInstall(candidate: SkillInstallCandidate) {
    const source = candidate.source.trim();
    if (!source) {
      toast.error("Enter a skill source.");
      return;
    }
    setSkillInstallCandidate({ ...candidate, source });
  }

  function submitSkillSourceInstall() {
    requestSkillInstall({
      name: skillSource.trim() || "Skill",
      source: skillSource,
    });
  }

  return {
    skillDialogOpen,
    skillInstallCandidate,
    skillQuery,
    skillSource,
    setSkillDialogOpen,
    setSkillInstallCandidate,
    setSkillQuery,
    setSkillSource,
    clearSkillInstallState,
    requestSkillInstall,
    submitSkillSourceInstall,
  };
}
