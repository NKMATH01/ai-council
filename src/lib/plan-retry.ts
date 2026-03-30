import { PlanAttempt, PlanLintIssue, PlanEvaluation } from "./types";

export const MAX_RETRIES = 3;

export type RetryReason =
  | { type: "schema_failure"; error: string }
  | { type: "lint_failure"; issues: PlanLintIssue[] }
  | { type: "eval_failure"; evaluation: PlanEvaluation };

/**
 * 재시도 허용 여부를 판단합니다.
 */
export function shouldRetry(
  attempts: PlanAttempt[],
  stage: PlanAttempt["stage"],
): boolean {
  const stageAttempts = attempts.filter((a) => a.stage === stage && !a.success);
  return stageAttempts.length < MAX_RETRIES;
}

/**
 * 재시도 사유를 repair 프롬프트용 결함 목록으로 변환합니다.
 */
export function buildRepairContext(reason: RetryReason): string {
  switch (reason.type) {
    case "schema_failure":
      return `## 이전 시도 실패 원인: 스키마 검증 실패
${reason.error}

위 오류를 수정하여 유효한 JSON을 다시 생성하세요. 누락된 필드를 채우고, 형식 오류를 바로잡으세요.`;

    case "lint_failure": {
      const errorIssues = reason.issues.filter((i) => i.severity === "error");
      const warningIssues = reason.issues.filter((i) => i.severity === "warning");
      let ctx = "## 이전 시도 실패 원인: 도메인 검증 실패\n\n";
      if (errorIssues.length > 0) {
        ctx += "### 반드시 수정할 오류:\n";
        ctx += errorIssues.map((i) => `- [${i.code}] ${i.message}`).join("\n");
        ctx += "\n\n";
      }
      if (warningIssues.length > 0) {
        ctx += "### 권장 수정 사항:\n";
        ctx += warningIssues.map((i) => `- [${i.code}] ${i.message}`).join("\n");
        ctx += "\n";
      }
      ctx += "\n## 재생성 지침\n";
      ctx += "- 위 결함 목록을 모두 해결한 새로운 계획을 생성하세요.\n";
      ctx += "- 이전 계획의 올바른 부분은 유지하되, 지적된 모든 오류를 수정하세요.\n";
      ctx += "- 수정 사항에 대한 설명 없이 바로 JSON을 반환하세요.\n";
      return ctx;
    }

    case "eval_failure": {
      const ev = reason.evaluation;
      const ctx = `## 이전 시도 실패 원인: 평가 미통과 (score: ${ev.score}/100)

### 평가 결과:
- 요구사항 반영률: ${ev.requirementCoverage}%
- CPS 정합성: ${ev.cpsAlignment}%
- 실행 가능성: ${ev.feasibility}%
- 환각 위험: ${ev.hallucinationRisk}%
- 누락 작업 위험: ${ev.missingWorkRisk}%

### 평가자 피드백:
${ev.reasons.map((r) => `- ${r}`).join("\n")}

### 구체적 수정 제안:
${ev.suggestedFixes.map((f) => `- ${f}`).join("\n")}

## 재생성 지침
- 위 평가 피드백의 suggestedFixes를 모두 반영하세요.
- score 70점 이상, hallucinationRisk 30% 이하, missingWorkRisk 40% 이하를 목표로 하세요.
- 요구사항에 없는 기능을 추가하지 마세요 (환각 위험 감소).
- 수정 사항에 대한 설명 없이 바로 JSON을 반환하세요.`;
      return ctx;
    }
  }
}

/**
 * PlanAttempt 레코드를 생성합니다.
 */
export function createAttempt(
  attempt: number,
  stage: PlanAttempt["stage"],
  success: boolean,
  issues: string[],
  model?: string,
  provider?: string,
): PlanAttempt {
  return {
    attempt,
    stage,
    success,
    issues,
    timestamp: Date.now(),
    model,
    provider,
  };
}
