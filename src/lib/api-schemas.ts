import { z } from "zod";

// ===== 공통 enum 값 =====
const DebateRoleIdSchema = z.enum([
  "architect", "critic", "creative", "frontend", "backend",
  "devops", "cost_analyst", "data_expert", "ux_advocate", "planner", "moderator",
]);

const DebateCommandSchema = z.enum([
  "quick", "deep", "debate", "consult", "extend", "fix", "ideate",
]);

const DebateStageIdSchema = z.enum([
  "independent", "critique", "final", "clarify", "user_perspective",
]);

const DebateEngineIdSchema = z.enum([
  "claude-sonnet", "claude-opus", "gpt", "gemini",
]);

const VerifyEngineIdSchema = z.enum([
  "chatgpt", "gemini", "claude-opus", "none",
]);

const VerificationProviderSchema = z.enum(["chatgpt", "gemini"]);

// ===== 하위 객체 스키마 =====
const DebateMessageSchema = z.object({
  id: z.string(),
  roleId: DebateRoleIdSchema,
  stage: DebateStageIdSchema,
  content: z.string(),
  timestamp: z.number(),
});

const FeedbackEntrySchema = z.object({
  id: z.string(),
  type: z.literal("feedback"),
  content: z.string(),
  timestamp: z.number(),
  afterRevision: z.number(),
});

const ParsedQuestionSchema = z.object({
  index: z.number(),
  text: z.string(),
  reason: z.string(),
  type: z.enum(["open", "choice"]),
  options: z.array(z.string()).optional(),
});

const ClarificationQASchema = z.object({
  id: z.string(),
  roleId: DebateRoleIdSchema,
  questions: z.string(),
  parsedQuestions: z.array(ParsedQuestionSchema).optional(),
  answers: z.string(),
  round: z.number(),
  timestamp: z.number(),
});

const ConsultInputSchema = z.object({
  projectName: z.string(),
  currentStatus: z.string(),
  techStack: z.string(),
  codeOrStructure: z.string(),
  question: z.string(),
});

const ExtendInputSchema = z.object({
  projectName: z.string(),
  currentFeatures: z.string(),
  techStack: z.string(),
  newFeature: z.string(),
  constraints: z.string(),
});

const FixInputSchema = z.object({
  projectName: z.string(),
  problem: z.string(),
  codeOrStructure: z.string(),
  techStack: z.string(),
  previousAttempts: z.string(),
});

const ModeInputSchema = z.union([
  ConsultInputSchema,
  ExtendInputSchema,
  FixInputSchema,
  z.null(),
]).optional();

const HarnessInputArtifactsSchema = z.object({
  requirementSpec: z.any().optional(),
  cps: z.any().optional(),
  generatedPlan: z.any().optional(),
  evaluation: z.any().optional(),
}).optional();

const RecommendationSchema = z.object({
  projectType: z.enum(["webapp", "api", "automation", "data", "mobile", "fullstack", "other"]),
  complexity: z.enum(["simple", "medium", "complex"]),
  suggestedRoles: z.array(DebateRoleIdSchema),
  optionalRoles: z.array(DebateRoleIdSchema),
  verificationAi: VerificationProviderSchema,
  reasoning: z.string(),
}).nullable();

const HarnessModelConfigSchema = z.object({
  provider: z.string(),
  model: z.string(),
});

const HarnessModelSettingsSchema = z.object({
  generation: HarnessModelConfigSchema.optional(),
  evaluation: HarnessModelConfigSchema.optional(),
}).optional();

// ===== API 요청 스키마 =====

/** POST /api/recommend */
export const RecommendRequestSchema = z.object({
  topic: z.string().min(1, "topic은 필수입니다"),
});

/** POST /api/debate */
export const DebateRequestSchema = z.object({
  roleId: DebateRoleIdSchema,
  topic: z.string().min(1, "topic은 필수입니다"),
  stage: DebateStageIdSchema,
  confirmedRoles: z.array(DebateRoleIdSchema),
  history: z.array(DebateMessageSchema),
  feedback: z.string().optional(),
  isRefine: z.boolean().optional(),
  debateEngine: DebateEngineIdSchema.optional(),
  techSpec: z.string().optional(),
  modeInput: ModeInputSchema,
  command: DebateCommandSchema.optional(),
});

/** POST /api/verify */
export const VerifyRequestSchema = z.object({
  provider: VerificationProviderSchema,
  topic: z.string().min(1, "topic은 필수입니다"),
  messages: z.array(DebateMessageSchema),
  confirmedRoles: z.array(DebateRoleIdSchema),
});

/** POST /api/synthesize */
export const SynthesizeRequestSchema = z.object({
  topic: z.string().min(1, "topic은 필수입니다"),
  messages: z.array(DebateMessageSchema),
  confirmedRoles: z.array(DebateRoleIdSchema),
  verificationResult: z.string().optional(),
  feedbacks: z.array(FeedbackEntrySchema).optional(),
  previousPrd: z.string().optional(),
  feedback: z.string().optional(),
  mode: z.enum(["initial", "refine"]).optional(),
  debateEngine: DebateEngineIdSchema.optional(),
  techSpec: z.string().optional(),
  modeInput: ModeInputSchema,
  command: DebateCommandSchema.optional(),
  source: z.enum(["debate", "harness"]).optional(),
  harnessArtifacts: HarnessInputArtifactsSchema,
});

/** POST /api/clarify */
export const ClarifyRequestSchema = z.object({
  roleId: DebateRoleIdSchema,
  topic: z.string().min(1, "topic은 필수입니다"),
  previousQA: z.array(ClarificationQASchema),
  round: z.number().int().min(1),
  phase: z.enum(["vision", "features", "technical", "resolution"]).optional(),
  debateEngine: DebateEngineIdSchema.optional(),
});

/** POST /api/generate-command */
export const GenerateCommandRequestSchema = z.object({
  topic: z.string().min(1, "topic은 필수입니다"),
  command: DebateCommandSchema,
  prd: z.string(),
  modeInput: ModeInputSchema,
  source: z.enum(["debate", "harness"]).optional(),
  harnessArtifacts: HarnessInputArtifactsSchema,
});

/** POST /api/generate-ui */
export const GenerateUiRequestSchema = z.object({
  prd: z.string(),
  existingHtml: z.string().optional(),
  modificationRequest: z.string().optional(),
  source: z.enum(["debate", "harness"]).optional(),
  harnessArtifacts: HarnessInputArtifactsSchema,
});

/** POST /api/plan-harness */
export const PlanHarnessRequestSchema = z.object({
  topic: z.string().min(1, "topic은 필수입니다"),
  command: DebateCommandSchema,
  modeInput: ModeInputSchema,
  techSpec: z.string().optional(),
  referencePrd: z.string().optional(),
  revisionRequest: z.string().optional(),
  previousPlanSummary: z.string().optional(),
  models: HarnessModelSettingsSchema,
});

/** POST /api/search (find similar debates) */
export const SearchSimilarRequestSchema = z.object({
  topic: z.string().min(1, "topic은 필수입니다"),
  excludeId: z.string().optional(),
});

/** POST /api/sessions (save session) — permissive schema */
export const SessionSaveSchema = z.object({
  id: z.string().min(1, "id는 필수입니다"),
  topic: z.string().min(1, "topic은 필수입니다"),
  command: DebateCommandSchema,
  debateEngine: DebateEngineIdSchema.optional(),
  verifyEngine: VerifyEngineIdSchema.optional(),
  techSpec: z.string().optional(),
  modeInput: ModeInputSchema,
  recommendation: RecommendationSchema.optional(),
  confirmedRoles: z.array(DebateRoleIdSchema).optional(),
  messages: z.array(DebateMessageSchema).optional(),
  verificationProvider: VerificationProviderSchema.nullable().optional(),
  verificationResult: z.string().optional(),
  prd: z.string().optional(),
  prdRevisions: z.array(z.string()).optional(),
  revisionCount: z.number().optional(),
  feedbacks: z.array(FeedbackEntrySchema).optional(),
  clarifications: z.array(ClarificationQASchema).optional(),
  clarificationRound: z.number().optional(),
  generatedCommand: z.string().optional(),
  prototypeHtml: z.string().optional(),
  harness: z.any().optional(),
  activeWorkflow: z.enum(["standard", "plan_harness"]).optional(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** PATCH /api/sessions (save UI version) */
export const SessionPatchSchema = z.object({
  debateId: z.string().min(1, "debateId는 필수입니다"),
  htmlCode: z.string().min(1, "htmlCode는 필수입니다"),
  modificationRequest: z.string().optional(),
});

// ===== 헬퍼 함수 =====

/**
 * 스키마를 사용해 요청 데이터를 검증하고 파싱합니다.
 * 유효하지 않은 데이터에 대해 ZodError를 throw합니다.
 */
export function validateRequest<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data);
}
