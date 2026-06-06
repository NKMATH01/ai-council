import type { DebateAction, DebateMessage, DebateStageId } from "./types";

export const DEBATE_CONFIDENCE_THRESHOLD = 75;

export interface DebateDecision {
  confidence?: number;
  needsMoreRounds?: boolean;
  reason?: string;
}

export function getDebateAction(stage: DebateStageId): DebateAction {
  switch (stage) {
    case "critique":
      return "rebut";
    case "final":
      return "judge";
    case "independent":
    case "clarify":
    case "user_perspective":
    default:
      return "argue";
  }
}

export function getDebateProtocolPrompt(stage: DebateStageId): string {
  const action = getDebateAction(stage);

  if (action === "argue") {
    return `## 토론 절차 규칙
- 현재 액션: ARGUE
- 자기 역할의 독립 주장과 근거를 제시하세요.
- 아직 합의를 만들지 말고, 판단에 필요한 가정/리스크를 명확히 드러내세요.`;
  }

  if (action === "rebut") {
    return `## 토론 절차 규칙
- 현재 액션: REBUT
- 이전 발언 중 최소 2개를 명시적으로 지목해 반박하거나 수정하세요.
- 각 반박은 "대상 역할 → 문제 → 수정안" 순서로 쓰세요.
- 단순 동의나 요약은 금지합니다.`;
  }

  return `## 토론 절차 규칙
- 현재 액션: JUDGE
- 다수 의견을 요약하는 데 그치지 말고 채택/기각/보류를 판정하세요.
- 끝까지 살아남은 반대 의견은 "소수 의견 / 보류 쟁점"으로 보존하세요.
- 마지막에 반드시 아래 형식을 그대로 포함하세요.

### 10. 판정 메타
- Confidence: 0-100 사이 정수
- Needs more rounds: yes 또는 no
- Reason: 한 문장`;
}

export function parseDebateDecision(content: string): DebateDecision {
  const confidenceMatch = content.match(/Confidence\s*:\s*(\d{1,3})/i);
  const needsMoreRoundsMatch = content.match(/Needs\s+more\s+rounds\s*:\s*(yes|no|true|false|예|아니오)/i);
  const reasonMatch = content.match(/Reason\s*:\s*(.+)/i);

  const confidence = confidenceMatch
    ? Math.max(0, Math.min(100, Number(confidenceMatch[1])))
    : undefined;

  const rawNeedsMoreRounds = needsMoreRoundsMatch?.[1]?.toLowerCase();
  const needsMoreRounds = rawNeedsMoreRounds
    ? ["yes", "true", "예"].includes(rawNeedsMoreRounds)
    : undefined;

  return {
    confidence,
    needsMoreRounds,
    reason: reasonMatch?.[1]?.trim(),
  };
}

export function shouldRunMoreDebate(decision: DebateDecision, rerunCount: number): boolean {
  if (rerunCount > 0) return false;
  if (decision.needsMoreRounds === true) return true;
  if (typeof decision.confidence === "number" && decision.confidence < DEBATE_CONFIDENCE_THRESHOLD) return true;
  return false;
}

export function getLatestJudgeDecision(messages: DebateMessage[]): DebateDecision | undefined {
  const judgeMessage = [...messages]
    .reverse()
    .find((m) => m.action === "judge" || (m.stage === "final" && m.roleId === "moderator"));

  if (!judgeMessage) return undefined;

  return {
    confidence: judgeMessage.confidence,
    needsMoreRounds: judgeMessage.needsMoreRounds,
    reason: judgeMessage.decisionReason,
    ...parseDebateDecision(judgeMessage.content),
  };
}

export function buildAutoRerunFeedback(decision: DebateDecision): string {
  const confidence = typeof decision.confidence === "number" ? `${decision.confidence}` : "미기재";
  const reason = decision.reason || "중재자의 판정 신뢰도가 낮거나 추가 라운드가 필요하다고 판단됨";

  return [
    "자동 재토론 요청:",
    `- Judge confidence: ${confidence}`,
    `- 추가 라운드 필요 사유: ${reason}`,
    "- 이전 최종안의 취약한 결정, 보류 쟁점, 소수 의견을 집중적으로 재검토하세요.",
    "- 새로운 아이디어를 무작정 늘리지 말고 기존 충돌을 해결하는 데 집중하세요.",
  ].join("\n");
}
