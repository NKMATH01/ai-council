import type {
  DebateState,
  DebateStatus,
  DebateMessage,
  DebateRoleId,
  Recommendation,
  VerificationProvider,
  FeedbackEntry,
  ClarificationQA,
  ClarificationPhase,
} from "./types";

// ===== Status Actions =====
type SetStatus = { type: "SET_STATUS"; status: DebateStatus; error?: string };
type SetError = { type: "SET_ERROR"; error: string };
type ClearError = { type: "CLEAR_ERROR" };
type SetSaveError = { type: "SET_SAVE_ERROR"; saveError?: string };

// ===== Session Lifecycle =====
type InitSession = { type: "INIT_SESSION"; state: DebateState };
type LoadSession = { type: "LOAD_SESSION"; state: DebateState };
type Reset = { type: "RESET" };

// ===== Debate Flow =====
type SetRecommendation = {
  type: "SET_RECOMMENDATION";
  recommendation: Recommendation;
  confirmedRoles: DebateRoleId[];
  status: DebateStatus;
};
type ConfirmRoles = { type: "CONFIRM_ROLES"; roles: DebateRoleId[]; status: DebateStatus };
type SetStage = { type: "SET_STAGE"; stage: string; status: DebateStatus };
type SetRoleIndex = { type: "SET_ROLE_INDEX"; index: number };
type SetMessages = { type: "SET_MESSAGES"; messages: DebateMessage[] };
type AddMessage = { type: "ADD_MESSAGE"; message: DebateMessage };

// ===== PRD =====
type StreamPrd = { type: "STREAM_PRD"; prd: string };
type CompletePrd = {
  type: "COMPLETE_PRD";
  prd: string;
  prdRevisions: string[];
  revisionCount: number;
  status: DebateStatus;
};

// ===== Verification =====
type SetVerifying = { type: "SET_VERIFYING"; provider: VerificationProvider };
type SetVerificationResult = { type: "SET_VERIFICATION_RESULT"; result: string };

// ===== Feedback =====
type SetFeedbacks = { type: "SET_FEEDBACKS"; feedbacks: FeedbackEntry[] };

// ===== Command & Prototype =====
type StreamCommand = { type: "STREAM_COMMAND"; generatedCommand: string };
type CompleteCommand = { type: "COMPLETE_COMMAND"; generatedCommand: string; status: DebateStatus };
type StreamPrototype = { type: "STREAM_PROTOTYPE"; prototypeHtml: string };
type CompletePrototype = { type: "COMPLETE_PROTOTYPE"; prototypeHtml: string; status: DebateStatus };

// ===== Clarification =====
type SetClarifications = {
  type: "SET_CLARIFICATIONS";
  clarifications: ClarificationQA[];
  status?: DebateStatus;
  clarificationPhase?: ClarificationPhase;
  clarificationRound?: number;
};

// ===== Harness (pragmatic escape hatch for complex harness state) =====
type UpdateHarness = { type: "UPDATE_HARNESS"; updates: Partial<DebateState> };

// ===== Union =====
export type DebateAction =
  | SetStatus
  | SetError
  | ClearError
  | SetSaveError
  | InitSession
  | LoadSession
  | Reset
  | SetRecommendation
  | ConfirmRoles
  | SetStage
  | SetRoleIndex
  | SetMessages
  | AddMessage
  | StreamPrd
  | CompletePrd
  | SetVerifying
  | SetVerificationResult
  | SetFeedbacks
  | StreamCommand
  | CompleteCommand
  | StreamPrototype
  | CompletePrototype
  | SetClarifications
  | UpdateHarness;
