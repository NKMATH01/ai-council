import { DebateEngineId, DebateRoleId, HarnessModelConfig } from "./types";

export function clampInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function clampFloat(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseFloat(value || "");
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export const USE_JUDGE: boolean = process.env.NEXT_PUBLIC_USE_JUDGE === "true";
export const MAX_ROUNDS: number = clampInt(process.env.NEXT_PUBLIC_MAX_ROUNDS, 4, 1, 10);
export const CONSENSUS_THRESHOLD: number = clampFloat(
  process.env.NEXT_PUBLIC_CONSENSUS_THRESHOLD,
  0.85,
  0,
  1,
);

export function shouldUseJudge(envUseJudge: boolean, snapUseJudge?: boolean): boolean {
  return !!envUseJudge || !!snapUseJudge;
}

export const DEBATER_LINEUP: ReadonlyArray<{ engine: DebateEngineId; roleId: DebateRoleId }> = [
  { engine: "gemini", roleId: "architect" },
  { engine: "gpt", roleId: "critic" },
  { engine: "claude-sonnet", roleId: "creative" },
];

export const JUDGE_MODEL: HarnessModelConfig = {
  provider: "anthropic",
  model: "claude-opus-4-8",
};
