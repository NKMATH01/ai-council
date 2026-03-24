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
  | "moderator";

// ===== 검증 AI =====
export type VerificationProvider = "chatgpt" | "gemini";

// ===== 토론 엔진 =====
export type DebateEngineId = "claude-sonnet" | "claude-opus" | "gpt" | "gemini";

// ===== 검증 엔진 (확장) =====
export type VerifyEngineId = "chatgpt" | "gemini" | "claude-opus" | "none";

// ===== 단축 명령어 =====
export type DebateCommand = "quick" | "deep" | "debate" | "consult" | "extend" | "fix";

// ===== 토론 단계 =====
export type DebateStageId = "independent" | "critique" | "final";

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
  | "debating"
  | "awaiting_verification"
  | "verifying"
  | "generating_prd"
  | "generating_command"
  | "generating_ui"
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
  generatedCommand: string;
  prototypeHtml: string;
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
  generatedCommand?: string;
  prototypeHtml?: string;
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
}

export interface GenerateCommandRequest {
  topic: string;
  command: DebateCommand;
  prd: string;
  modeInput?: ModeInput;
}

export interface GenerateUiRequest {
  prd: string;
  existingHtml?: string;
  modificationRequest?: string;
}
