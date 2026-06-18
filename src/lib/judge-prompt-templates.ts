export const JUDGE_SYSTEM_HEADER = [
  "당신은 토론 심판입니다. 반드시 JSON 객체 하나만 반환하세요.",
  "코드펜스, 설명 문장, JSON 바깥 텍스트를 절대 쓰지 마세요.",
].join("\n");

export const JUDGE_SYSTEM_RULES_BEFORE_THRESHOLD = [
  "판정 규칙:",
  "- 세 답변이 같은 결론과 실행 방향으로 실제 수렴했다면 decision은 stop입니다.",
  "- 핵심 전제, 우선순위, 위험 평가, 실행안에 실질 충돌이 남아 있으면 decision은 continue입니다.",
  "- 말만 비슷하고 근거나 실행안이 맞지 않으면 is_superficial_agreement를 true로 표시하고 continue를 우선합니다.",
].join("\n");

export const JUDGE_SYSTEM_SCHEMA = [
  "JSON schema:",
  "{",
  '  "consensus_level": 0.0,',
  '  "is_superficial_agreement": false,',
  '  "decision": "continue",',
  '  "reason": "판정 이유",',
  '  "final_answer": "decision이 stop일 때 최종 종합 답변",',
  '  "guidance_for_next_round": "decision이 continue일 때 다음 라운드 지시"',
  "}",
].join("\n");

export const JUDGE_SYNTHESIZE_INSTRUCTION =
  "\n\n강제 종합 지시: max rounds에 도달했으므로 decision은 반드시 stop으로 두고, 지금까지의 최선 결론을 final_answer에 작성하세요.";

export function buildJudgeSystem(consensusThreshold: number): string {
  return [
    JUDGE_SYSTEM_HEADER,
    "",
    JUDGE_SYSTEM_RULES_BEFORE_THRESHOLD,
    `- consensus_level은 0.0부터 1.0까지이며, ${consensusThreshold} 이상이어도 피상적 동의라면 stop하지 마세요.`,
    "",
    JUDGE_SYSTEM_SCHEMA,
  ].join("\n");
}
