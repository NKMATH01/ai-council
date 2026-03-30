// ===== 프로젝트 분석 타입 =====
export type ProjectType = "webapp" | "api" | "automation" | "data" | "mobile" | "fullstack" | "other";
export type Complexity = "simple" | "medium" | "complex";

// ===== 역할 시스템 =====
export type DebateRoleId =
  | "architect"
  | "critic"
  | "creative"
  | "frontend"
  | "backend"
  | "devops"
  | "cost_analyst"
  | "data_expert"
  | "ux_advocate"
  | "planner"
  | "moderator";

// ===== 검증 AI =====
export type VerificationProvider = "chatgpt" | "gemini";

// ===== 토론 엔진 =====
export type DebateEngineId = "claude-sonnet" | "claude-opus" | "gpt" | "gemini";

// ===== 검증 엔진 (확장) =====
export type VerifyEngineId = "chatgpt" | "gemini" | "claude-opus" | "none";

// ===== 단축 명령어 =====
export type DebateCommand = "quick" | "deep" | "debate" | "consult" | "extend" | "fix" | "ideate";

// ===== 토론 단계 =====
export type DebateStageId = "independent" | "critique" | "final" | "clarify" | "user_perspective";

// ===== 모드별 입력 양식 =====
export interface ConsultInput {
  projectName: string;
  currentStatus: string;
  techStack: string;
  codeOrStructure: string;
  question: string;
}

export interface ExtendInput {
  projectName: string;
  currentFeatures: string;
  techStack: string;
  newFeature: string;
  constraints: string;
}

export interface FixInput {
  projectName: string;
  problem: string;
  codeOrStructure: string;
  techStack: string;
  previousAttempts: string;
}

export type ModeInput = ConsultInput | ExtendInput | FixInput | null;

// ===== Clarification Phase =====
export type ClarificationPhase = "vision" | "features" | "technical" | "resolution";

// ===== 아이디어 구체화 Q&A =====
export interface ParsedQuestion {
  index: number;
  text: string;
  reason: string;
  type: "open" | "choice";
  options?: string[];       // 객관식 선택지
}

export interface ClarificationQA {
  id: string;
  roleId: DebateRoleId;
  questions: string;
  parsedQuestions?: ParsedQuestion[];  // 파싱된 구조화 질문
  answers: string;
  round: number;
  phase?: ClarificationPhase;  // NEW: which clarification phase this belongs to
  timestamp: number;
}

// ===== 추천 결과 =====
export interface Recommendation {
  projectType: ProjectType;
  complexity: Complexity;
  suggestedRoles: DebateRoleId[];
  optionalRoles: DebateRoleId[];
  verificationAi: VerificationProvider;
  reasoning: string;
}

// ===== 토론 메시지 =====
export interface DebateMessage {
  id: string;
  roleId: DebateRoleId;
  stage: DebateStageId;
  content: string;
  timestamp: number;
}

// ===== 피드백 =====
export interface FeedbackEntry {
  id: string;
  type: "feedback";
  content: string;
  timestamp: number;
  afterRevision: number;
}

// ===== 상태 =====
export type DebateStatus =
  | "idle"
  | "recommending"
  | "awaiting_confirmation"
  | "clarifying"
  | "awaiting_clarification"
  | "debating"
  | "debating_user_perspective"
  | "awaiting_verification"
  | "verifying"
  | "generating_prd"
  | "generating_command"
  | "generating_ui"
  | "generating_plan"
  | "complete"
  | "error";

export interface DebateState {
  topic: string;
  command: DebateCommand;
  debateEngine: DebateEngineId;
  verifyEngine: VerifyEngineId;
  techSpec: string;
  modeInput: ModeInput;
  recommendation: Recommendation | null;
  confirmedRoles: DebateRoleId[];
  currentStage: DebateStageId;
  currentRoleIndex: number;
  messages: DebateMessage[];
  verificationProvider: VerificationProvider | null;
  verificationResult: string;
  prd: string;
  prdRevisions: string[];
  revisionCount: number;
  feedbacks: FeedbackEntry[];
  clarifications: ClarificationQA[];
  clarificationRound: number;
  clarificationPhase: ClarificationPhase;
  generatedCommand: string;
  prototypeHtml: string;
  harness?: PlanHarnessArtifacts;
  activeWorkflow?: "standard" | "plan_harness";
  currentHarnessStage?: PlanHarnessStage;
  harnessUserSummary?: string;
  harnessRevisionRequest?: string;
  harnessRunCount?: number;
  status: DebateStatus;
  error?: string;
  saveError?: string;
  sessionId?: string;
  createdAt?: string;
}

// ===== 세션 (저장용) =====
export interface Session {
  id: string;
  topic: string;
  command: DebateCommand;
  debateEngine?: DebateEngineId;
  verifyEngine?: VerifyEngineId;
  techSpec?: string;
  modeInput?: ModeInput;
  recommendation: Recommendation | null;
  confirmedRoles: DebateRoleId[];
  messages: DebateMessage[];
  verificationProvider: VerificationProvider | null;
  verificationResult: string;
  prd: string;
  prdRevisions: string[];
  revisionCount: number;
  feedbacks: FeedbackEntry[];
  clarifications?: ClarificationQA[];
  clarificationRound?: number;
  generatedCommand?: string;
  prototypeHtml?: string;
  harness?: PlanHarnessArtifacts;
  activeWorkflow?: "standard" | "plan_harness";
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  revisionCount: number;
  messageCount: number;
  status?: string;
  prdPreview?: string;
  command?: DebateCommand;
}

// ===== API 요청 타입 =====
export interface RecommendRequest {
  topic: string;
}

export interface DebateRequest {
  roleId: DebateRoleId;
  topic: string;
  stage: DebateStageId;
  confirmedRoles: DebateRoleId[];
  history: DebateMessage[];
  feedback?: string;
  isRefine?: boolean;
  debateEngine?: DebateEngineId;
  techSpec?: string;
  modeInput?: ModeInput;
  command?: DebateCommand;
}

export interface VerifyRequest {
  provider: VerificationProvider;
  topic: string;
  messages: DebateMessage[];
  confirmedRoles: DebateRoleId[];
}

export interface SynthesizeRequest {
  topic: string;
  messages: DebateMessage[];
  confirmedRoles: DebateRoleId[];
  verificationResult?: string;
  feedbacks?: FeedbackEntry[];
  previousPrd?: string;
  feedback?: string;
  mode?: "initial" | "refine";
  debateEngine?: DebateEngineId;
  techSpec?: string;
  modeInput?: ModeInput;
  command?: DebateCommand;
  source?: "debate" | "harness";
  harnessArtifacts?: HarnessInputArtifacts;
}

export interface ClarifyRequest {
  roleId: DebateRoleId;
  topic: string;
  previousQA: ClarificationQA[];
  round: number;
  debateEngine?: DebateEngineId;
}

export interface GenerateCommandRequest {
  topic: string;
  command: DebateCommand;
  prd: string;
  modeInput?: ModeInput;
  source?: "debate" | "harness";
  harnessArtifacts?: HarnessInputArtifacts;
}

export interface GenerateUiRequest {
  prd: string;
  existingHtml?: string;
  modificationRequest?: string;
  source?: "debate" | "harness";
  harnessArtifacts?: HarnessInputArtifacts;
}

// 하네스 기반 생성 시 API에 전달하는 구조화된 입력
export interface HarnessInputArtifacts {
  requirementSpec?: RequirementSpec;
  cps?: CpsDocument;
  generatedPlan?: GeneratedPlan;
  evaluation?: PlanEvaluation;
}

// ===== Plan Harness 타입 =====
export interface RequirementSpec {
  userIntent: string;
  targetOutcome: string;
  constraints: string[];
  nonGoals: string[];
  preferredFormat: string[];
  assumptions: string[];
  missingInfo: string[];
  sourceTopic: string;
  sourceCommand: DebateCommand;
}

export interface CpsDocument {
  context: string;
  problem: string;
  solution: string;
  successCriteria: string[];
  risks: string[];
}

export interface PlanMilestone {
  id: string;
  title: string;
  objective: string;
  exitCriteria: string[];
}

export interface PlanTask {
  id: string;
  title: string;
  detail: string;
  milestoneId: string;
  dependsOn: string[];
  ownerHint: string;
  deliverable: string;
}

export interface GeneratedPlan {
  title: string;
  objective: string;
  milestones: PlanMilestone[];
  tasks: PlanTask[];
  dependencies: { from: string; to: string; reason: string }[];
  risks: string[];
  acceptanceCriteria: string[];
  executionOrder: string[];
  estimatedComplexity: "simple" | "medium" | "complex";
}

export interface PlanLintIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
}

export interface PlanEvaluation {
  score: number;
  requirementCoverage: number;
  cpsAlignment: number;
  feasibility: number;
  hallucinationRisk: number;
  missingWorkRisk: number;
  reasons: string[];
  warnings: string[];
  suggestedFixes: string[];
  passed: boolean;
}

export interface PlanAttempt {
  attempt: number;
  stage: "normalize" | "cps" | "generate" | "lint" | "evaluate" | "repair";
  success: boolean;
  issues: string[];
  timestamp: number;
  model?: string;
  provider?: string;
}

export interface HarnessRunSnapshot {
  runNumber: number;
  revisionRequest?: string;
  completedAt: number;
  generatedPlan?: GeneratedPlan;
  evaluation?: PlanEvaluation;
  topic: string;
}

export interface PlanHarnessArtifacts {
  requirementSpec?: RequirementSpec;
  cps?: CpsDocument;
  generatedPlan?: GeneratedPlan;
  lintIssues: PlanLintIssue[];
  evaluation?: PlanEvaluation;
  attempts: PlanAttempt[];
  history?: HarnessRunSnapshot[];
  runCount?: number;
  revisionRequest?: string;
  userSummary?: string;
}

// ===== Plan Harness Stream Events (NDJSON) =====
export type PlanHarnessStage = "normalize" | "cps" | "generate" | "lint" | "evaluate" | "repair";

export type PlanHarnessStreamEvent =
  | { event: "started"; timestamp: number }
  | { event: "stage_started"; stage: PlanHarnessStage; timestamp: number }
  | { event: "attempt"; attempt: PlanAttempt; timestamp: number }
  | { event: "lint_result"; issues: PlanLintIssue[]; errorCount: number; warningCount: number; timestamp: number }
  | { event: "evaluation_result"; evaluation: PlanEvaluation; timestamp: number }
  | {
      event: "completed";
      success: boolean;
      requirementSpec?: RequirementSpec;
      cps?: CpsDocument;
      generatedPlan?: GeneratedPlan;
      lintIssues: PlanLintIssue[];
      evaluation?: PlanEvaluation;
      attempts: PlanAttempt[];
      userFacingSummary: string;
      timestamp: number;
    }
  | { event: "error"; failedStage?: string; message: string; attempts: PlanAttempt[]; timestamp: number }
  | { event: "aborted"; stage?: PlanHarnessStage; attempts: PlanAttempt[]; timestamp: number };

export interface HarnessModelConfig {
  provider: string;
  model: string;
}

export interface HarnessModelSettings {
  generation?: HarnessModelConfig;
  evaluation?: HarnessModelConfig;
}

export interface PlanHarnessRequest {
  topic: string;
  command: DebateCommand;
  modeInput?: ModeInput;
  techSpec?: string;
  referencePrd?: string;
  revisionRequest?: string;
  previousPlanSummary?: string;
  models?: HarnessModelSettings;
}

export interface PlanHarnessResponse {
  success: boolean;
  requirementSpec?: RequirementSpec;
  cps?: CpsDocument;
  generatedPlan?: GeneratedPlan;
  lintIssues: PlanLintIssue[];
  evaluation?: PlanEvaluation;
  attempts: PlanAttempt[];
  userFacingSummary: string;
  failedStage?: string;
  error?: string;
}
