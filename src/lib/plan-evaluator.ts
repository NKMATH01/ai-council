import { RequirementSpec, CpsDocument, GeneratedPlan, PlanEvaluation } from "./types";

/**
 * 평가기 프롬프트를 생성합니다.
 * 출력: PlanEvaluation JSON만 반환해야 합니다.
 */
export function buildEvaluatorPrompt(
  requirementSpec: RequirementSpec,
  cps: CpsDocument,
  plan: GeneratedPlan,
): { system: string; user: string } {
  const system = `당신은 소프트웨어 프로젝트 계획 평가 전문가입니다.
주어진 요구사항 명세(RequirementSpec), CPS 문서, 생성된 계획(GeneratedPlan)을 분석하여
정량적 평가를 수행합니다.

## 출력 규칙 (절대 준수 — 위반 시 즉시 실패)
- 응답 전체가 하나의 JSON 객체여야 합니다. { 로 시작하고 } 로 끝나야 합니다.
- 코드펜스(\`\`\`), 마크다운 헤더(#), 설명 텍스트, 인사말을 절대 포함하지 마세요.
- JSON 앞뒤에 공백/줄바꿈 외 텍스트가 1글자라도 있으면 파싱 실패로 처리됩니다.
- "네, 알겠습니다" 같은 응답 시작 금지. 바로 { 부터 시작하세요.

## 평가 기준

### 점수 산출 (score는 가중 평균)
- requirementCoverage (30%): constraints, targetOutcome, nonGoals 반영도.
  constraints 항목마다 대응 task가 있는지 확인. 없으면 -10점/개.
- cpsAlignment (20%): successCriteria가 acceptanceCriteria로 변환됐는지.
- feasibility (20%): 의존성 순서 합리성, 시간 제약 대비 task 양, 기술 실현 가능성.
  시간 제약이 있을 때(예: "2주") task 총량이 비현실적이면 감점.
- hallucinationRisk (15%): nonGoals에 해당하는 작업이 포함됐으면 +20. 요구사항에 없는 기능 +10/개.
- missingWorkRisk (15%): constraints/successCriteria에 있으나 plan에 없는 항목당 +15.

### 세부 지표
- requirementCoverage: 0-100
- cpsAlignment: 0-100
- feasibility: 0-100
- hallucinationRisk: 0-100. 높을수록 위험.
- missingWorkRisk: 0-100. 높을수록 위험.
- reasons: 3-5개 문장. 감점 사유를 구체적으로.
- warnings: 0-3개. nonGoals 위반, 시간 초과 위험, 단일 ownerHint 등.
- suggestedFixes: 0-5개. "~을 추가하세요", "~을 제거하세요" 형태.
- passed: score >= 70 이고 hallucinationRisk <= 30 이고 missingWorkRisk <= 40 이고 requirementCoverage >= 60 이고 cpsAlignment >= 50 이면 true

### 엄격 평가 지침
- 느슨한 평가 금지. 모든 constraints를 하나씩 검증하라.
- nonGoals에 해당하는 작업이 plan에 있으면 hallucinationRisk에 반드시 반영.
- "좋은 계획입니다" 같은 일반론은 reasons에 넣지 마라. 구체적 근거만.

## JSON 스키마
{
  "score": number,
  "requirementCoverage": number,
  "cpsAlignment": number,
  "feasibility": number,
  "hallucinationRisk": number,
  "missingWorkRisk": number,
  "reasons": string[],
  "warnings": string[],
  "suggestedFixes": string[],
  "passed": boolean
}`;

  const user = `## RequirementSpec
${JSON.stringify(requirementSpec, null, 2)}

## CpsDocument
${JSON.stringify(cps, null, 2)}

## GeneratedPlan
${JSON.stringify(plan, null, 2)}

위 세 문서를 분석하여 PlanEvaluation JSON을 반환하세요. JSON만 반환하세요.`;

  return { system, user };
}

/**
 * 평가 결과에서 passed 판정을 보정합니다.
 * evaluator가 너무 느슨할 경우를 대비한 이중 검증.
 */
export function enforcePassCriteria(evaluation: PlanEvaluation): PlanEvaluation {
  const shouldPass =
    evaluation.score >= 70 &&
    evaluation.hallucinationRisk <= 30 &&
    evaluation.missingWorkRisk <= 40 &&
    evaluation.requirementCoverage >= 60 &&
    evaluation.cpsAlignment >= 50;

  return {
    ...evaluation,
    passed: shouldPass,
  };
}
