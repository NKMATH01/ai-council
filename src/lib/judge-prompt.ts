import { ROLE_POOL } from "./constants";
import { DebaterTurn } from "./judge-loop";
import { buildJudgeSystem, JUDGE_SYNTHESIZE_INSTRUCTION } from "./judge-prompt-templates";

export function buildJudgeMessages({
  topic,
  transcript,
  round,
  maxRounds,
  consensusThreshold,
  synthesize,
}: {
  topic: string;
  transcript: DebaterTurn[];
  round: number;
  maxRounds?: number;
  consensusThreshold?: number;
  synthesize?: boolean;
}): { system: string; user: string } {
  const transcriptText = transcript.map((turn) => {
    const roleName = ROLE_POOL[turn.roleId]?.koreanName || turn.roleId;
    return `[R${turn.round}] ${turn.engine} (${roleName})\n${turn.content}`;
  }).join("\n\n");

  const threshold = consensusThreshold ?? 0.85;
  const system = buildJudgeSystem(threshold);

  const synthesizeInstruction = synthesize
    ? JUDGE_SYNTHESIZE_INSTRUCTION
    : "";

  const user = [
    `## 주제\n${topic}`,
    `## 라운드\n현재 라운드: ${round}${maxRounds ? ` / 최대 라운드: ${maxRounds}` : ""}`,
    `## 종합 모드\n${synthesize ? "true" : "false"}`,
    `## 토론 기록\n${transcriptText || "(토론 기록 없음)"}`,
    synthesizeInstruction,
    "## 평가 지시\n각 토론자 답변이 위 '주제'를 실제로 다루는지 먼저 확인하고, 주제 이탈·피상적 동의를 반영해 판정하세요.",
    "\nJSON 객체 하나만 반환하세요.",
  ].join("\n\n");

  return { system, user };
}
