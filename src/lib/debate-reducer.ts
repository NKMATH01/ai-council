import type { DebateState } from "./types";
import type { DebateAction } from "./debate-actions";

export const initialState: DebateState = {
  topic: "",
  command: "debate",
  debateEngine: "claude-sonnet",
  verifyEngine: "chatgpt",
  techSpec: "",
  modeInput: null,
  recommendation: null,
  confirmedRoles: [],
  currentStage: "independent",
  currentRoleIndex: 0,
  messages: [],
  verificationProvider: null,
  verificationResult: "",
  prd: "",
  prdRevisions: [],
  revisionCount: 0,
  feedbacks: [],
  clarifications: [],
  clarificationRound: 0,
  clarificationPhase: "vision",
  generatedCommand: "",
  prototypeHtml: "",
  status: "idle",
  createdAt: "",
};

export function debateReducer(state: DebateState, action: DebateAction): DebateState {
  switch (action.type) {
    case "SET_STATUS":
      return {
        ...state,
        status: action.status,
        ...(action.error !== undefined ? { error: action.error } : {}),
      };

    case "SET_ERROR":
      return { ...state, status: "error", error: action.error };

    case "CLEAR_ERROR":
      return { ...state, error: undefined };

    case "SET_SAVE_ERROR":
      return { ...state, saveError: action.saveError };

    case "INIT_SESSION":
    case "LOAD_SESSION":
      return action.state;

    case "RESET":
      return initialState;

    case "SET_RECOMMENDATION":
      return {
        ...state,
        recommendation: action.recommendation,
        confirmedRoles: action.confirmedRoles,
        status: action.status,
      };

    case "CONFIRM_ROLES":
      return { ...state, confirmedRoles: action.roles, status: action.status };

    case "SET_STAGE":
      return { ...state, currentStage: action.stage as DebateState["currentStage"], status: action.status };

    case "SET_ROLE_INDEX":
      return { ...state, currentRoleIndex: action.index };

    case "SET_MESSAGES":
      return { ...state, messages: action.messages };

    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };

    case "STREAM_PRD":
      return { ...state, prd: action.prd };

    case "COMPLETE_PRD":
      return {
        ...state,
        prd: action.prd,
        prdRevisions: action.prdRevisions,
        revisionCount: action.revisionCount,
        status: action.status,
      };

    case "SET_VERIFYING":
      return { ...state, status: "verifying", verificationProvider: action.provider };

    case "SET_VERIFICATION_RESULT":
      return { ...state, verificationResult: action.result };

    case "SET_FEEDBACKS":
      return { ...state, feedbacks: action.feedbacks };

    case "STREAM_COMMAND":
      return { ...state, generatedCommand: action.generatedCommand };

    case "COMPLETE_COMMAND":
      return { ...state, generatedCommand: action.generatedCommand, status: action.status };

    case "STREAM_PROTOTYPE":
      return { ...state, prototypeHtml: action.prototypeHtml };

    case "COMPLETE_PROTOTYPE":
      return { ...state, prototypeHtml: action.prototypeHtml, status: action.status };

    case "SET_CLARIFICATIONS":
      return {
        ...state,
        clarifications: action.clarifications,
        ...(action.status !== undefined ? { status: action.status } : {}),
        ...(action.clarificationPhase !== undefined ? { clarificationPhase: action.clarificationPhase } : {}),
        ...(action.clarificationRound !== undefined ? { clarificationRound: action.clarificationRound } : {}),
      };

    case "UPDATE_HARNESS":
      return { ...state, ...action.updates };

    default:
      return state;
  }
}
