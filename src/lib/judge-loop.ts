import { DebateEngineId, DebateRoleId, DebateStageId, JudgeVerdict } from "./types";

const DEFAULT_GUIDANCE = "실제 충돌점, 누락된 근거, 합의 가능한 실행안을 더 구체적으로 지적하세요.";

export interface DebaterTurn {
  round: number;
  engine: DebateEngineId;
  roleId: DebateRoleId;
  content: string;
}

export type JudgeStopReason = "judge_stop" | "max_rounds";

export interface JudgeLoopResult {
  rounds: number;
  stopReason: JudgeStopReason;
  finalAnswer: string;
  turns: DebaterTurn[];
  verdicts: JudgeVerdict[];
}

export interface JudgeLoopOptions {
  maxRounds: number;
  lineup: ReadonlyArray<{ engine: DebateEngineId; roleId: DebateRoleId }>;
  signal?: AbortSignal;
  callDebater: (
    engine: DebateEngineId,
    roleId: DebateRoleId,
    round: number,
    stage: DebateStageId,
    guidance?: string,
  ) => Promise<string>;
  callJudge: (round: number, turns: DebaterTurn[], synthesize: boolean) => Promise<JudgeVerdict>;
  onTurn?: (turn: DebaterTurn) => void | Promise<void>;
  onVerdict?: (verdict: JudgeVerdict, round: number) => void | Promise<void>;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("AbortError", "AbortError");
  }
}

export async function runJudgeLoop(options: JudgeLoopOptions): Promise<JudgeLoopResult> {
  const turns: DebaterTurn[] = [];
  const verdicts: JudgeVerdict[] = [];
  let round = 0;
  let guidance: string | undefined;

  while (round < options.maxRounds) {
    throwIfAborted(options.signal);
    round += 1;
    // 마지막 라운드는 토론자에게 final(수렴/확정) 단계를 줘서 심판 종합 전에 수렴을 유도한다.
    const stage: DebateStageId = round === 1
      ? "independent"
      : round === options.maxRounds
        ? "final"
        : "critique";

    for (const debater of options.lineup) {
      throwIfAborted(options.signal);
      const content = await options.callDebater(debater.engine, debater.roleId, round, stage, guidance);
      const turn: DebaterTurn = {
        round,
        engine: debater.engine,
        roleId: debater.roleId,
        content,
      };
      turns.push(turn);
      await options.onTurn?.(turn);
    }

    throwIfAborted(options.signal);
    const verdict = await options.callJudge(round, turns, false);
    verdicts.push(verdict);
    await options.onVerdict?.(verdict, round);

    if (verdict.decision === "stop") {
      return {
        rounds: round,
        stopReason: "judge_stop",
        finalAnswer: verdict.final_answer || "",
        turns,
        verdicts,
      };
    }

    guidance = verdict.guidance_for_next_round;
  }

  throwIfAborted(options.signal);
  const finalVerdict = await options.callJudge(round, turns, true);
  verdicts.push(finalVerdict);
  await options.onVerdict?.(finalVerdict, round);

  return {
    rounds: round,
    stopReason: "max_rounds",
    finalAnswer: finalVerdict.final_answer || "",
    turns,
    verdicts,
  };
}

export function parseJudgeVerdict(raw: string): JudgeVerdict | null {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) return null;

  try {
    return normalizeVerdict(JSON.parse(stripped.slice(start, end + 1)));
  } catch {
    return null;
  }
}

export function normalizeVerdict(value: unknown): JudgeVerdict | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const decision = record.decision;
  if (decision !== "stop" && decision !== "continue") return null;

  const rawConsensus = typeof record.consensus_level === "number"
    ? record.consensus_level
    : Number(record.consensus_level);
  const consensusLevel = Number.isFinite(rawConsensus)
    ? Math.min(1, Math.max(0, rawConsensus))
    : 0;

  const guidance = typeof record.guidance_for_next_round === "string"
    ? record.guidance_for_next_round.trim()
    : "";

  const verdict: JudgeVerdict = {
    consensus_level: consensusLevel,
    is_superficial_agreement: record.is_superficial_agreement === true,
    decision,
    reason: typeof record.reason === "string" ? record.reason : "",
    ...(typeof record.final_answer === "string" ? { final_answer: record.final_answer } : {}),
    ...(typeof record.round === "number" ? { round: record.round } : {}),
  };

  if (decision === "continue") {
    // continue인데 다음 라운드 지시가 비면 기본 guidance를 강제 주입(방향 없는 라운드 방지).
    verdict.guidance_for_next_round = guidance || DEFAULT_GUIDANCE;
  } else if (guidance) {
    verdict.guidance_for_next_round = guidance;
  }

  return verdict;
}

export function fallbackVerdict(reason?: string): JudgeVerdict {
  return {
    consensus_level: 0,
    is_superficial_agreement: false,
    decision: "continue",
    reason: reason || "심판 응답을 해석하지 못해 다음 라운드를 진행합니다.",
    guidance_for_next_round: DEFAULT_GUIDANCE,
  };
}
