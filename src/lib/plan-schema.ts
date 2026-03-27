import { z } from "zod";

export const RequirementSpecSchema = z.object({
  userIntent: z.string().min(1, "userIntent는 필수입니다"),
  targetOutcome: z.string().min(1, "targetOutcome은 필수입니다"),
  constraints: z.array(z.string()),
  nonGoals: z.array(z.string()),
  preferredFormat: z.array(z.string()),
  assumptions: z.array(z.string()),
  missingInfo: z.array(z.string()),
  sourceTopic: z.string(),
  sourceCommand: z.enum(["quick", "deep", "debate", "consult", "extend", "fix", "ideate"]),
});

export const CpsDocumentSchema = z.object({
  context: z.string().min(10, "context는 최소 10자 이상이어야 합니다"),
  problem: z.string().min(10, "problem은 최소 10자 이상이어야 합니다"),
  solution: z.string().min(10, "solution은 최소 10자 이상이어야 합니다"),
  successCriteria: z.array(z.string()).min(1, "successCriteria는 1개 이상 필요합니다"),
  risks: z.array(z.string()),
});

export const PlanMilestoneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  exitCriteria: z.array(z.string()).min(1),
});

export const PlanTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(5, "task title은 최소 5자 이상이어야 합니다"),
  detail: z.string().min(5, "task detail은 최소 5자 이상이어야 합니다"),
  milestoneId: z.string().min(1),
  dependsOn: z.array(z.string()),
  ownerHint: z.string(),
  deliverable: z.string().min(3, "deliverable은 최소 3자 이상이어야 합니다"),
});

export const GeneratedPlanSchema = z.object({
  title: z.string().min(1),
  objective: z.string().min(1),
  milestones: z.array(PlanMilestoneSchema).min(1, "milestone은 최소 1개 이상 필요합니다"),
  tasks: z.array(PlanTaskSchema).min(1, "task는 최소 1개 이상 필요합니다"),
  dependencies: z.array(z.object({
    from: z.string(),
    to: z.string(),
    reason: z.string(),
  })),
  risks: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()).min(3, "acceptanceCriteria는 최소 3개 필요합니다"),
  executionOrder: z.array(z.string()).min(1),
  estimatedComplexity: z.enum(["simple", "medium", "complex"]),
});

export const PlanEvaluationSchema = z.object({
  score: z.number().min(0).max(100),
  requirementCoverage: z.number().min(0).max(100),
  cpsAlignment: z.number().min(0).max(100),
  feasibility: z.number().min(0).max(100),
  hallucinationRisk: z.number().min(0).max(100),
  missingWorkRisk: z.number().min(0).max(100),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  suggestedFixes: z.array(z.string()),
  passed: z.boolean(),
});

/**
 * 엄격한 JSON 추출.
 * - 앞뒤 공백/줄바꿈만 허용
 * - 코드펜스, 산문, 인사말이 붙으면 실패
 * - { 로 시작하고 } 로 끝나야 함
 * 실패 시 에러 throw
 */
export function extractJson(raw: string): string {
  const cleaned = raw.trim();

  // 코드펜스 감지 → 실패
  if (cleaned.includes("```")) {
    throw new Error("코드펜스(```)가 포함되어 있습니다. 순수 JSON만 반환해야 합니다.");
  }

  // { 로 시작하지 않으면 실패
  if (!cleaned.startsWith("{")) {
    const preview = cleaned.substring(0, 60).replace(/\n/g, "\\n");
    throw new Error(`응답이 '{'로 시작하지 않습니다. 앞부분: "${preview}..."`);
  }

  // } 로 끝나지 않으면 실패
  if (!cleaned.endsWith("}")) {
    const preview = cleaned.substring(cleaned.length - 60).replace(/\n/g, "\\n");
    throw new Error(`응답이 '}'로 끝나지 않습니다. 뒷부분: "...${preview}"`);
  }

  return cleaned;
}

/**
 * JSON 파싱 + zod 검증을 결합합니다.
 * 실패 시 { success: false, error } 반환
 */
export function parseAndValidate<T>(
  raw: string,
  schema: z.ZodType<T>,
): { success: true; data: T } | { success: false; error: string } {
  try {
    const jsonStr = extractJson(raw);
    const parsed = JSON.parse(jsonStr);
    const result = schema.safeParse(parsed);
    if (result.success) {
      return { success: true, data: result.data };
    }
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { success: false, error: `스키마 검증 실패: ${issues}` };
  } catch (e: any) {
    return { success: false, error: `JSON 파싱 실패: ${e.message}` };
  }
}
