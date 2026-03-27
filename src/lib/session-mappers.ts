import { DebateState, Recommendation, Session } from "./types";

type ActiveWorkflow = Session["activeWorkflow"];
export type HarnessStorageMode = "dedicated" | "legacy";

type RecommendationPayload = Record<string, unknown> & {
  _harness?: Session["harness"];
  _activeWorkflow?: ActiveWorkflow;
};

interface BuildSessionRowOptions {
  harnessStorage?: HarnessStorageMode;
}

export interface SessionRow {
  id: string;
  mode: Session["command"];
  topic: string;
  engine_model: Session["debateEngine"] | "claude-sonnet";
  reviewer_model: Session["verifyEngine"] | "chatgpt";
  roles: Session["confirmedRoles"];
  messages: Session["messages"];
  prd: string;
  html_ui: string;
  claude_command: string;
  status: string;
  recommendation: RecommendationPayload | Recommendation | null;
  harness_data?: Session["harness"] | null;
  active_workflow?: ActiveWorkflow | null;
  verification_provider: Session["verificationProvider"] | "";
  verification_result: string;
  prd_revisions: Session["prdRevisions"];
  revision_count: number;
  feedbacks: Session["feedbacks"];
  mode_input: Session["modeInput"] | null;
  created_at: string;
  updated_at: string;
}

export function buildSessionFromState(
  snap: DebateState,
  statusOverride?: string,
): Session {
  return {
    id: snap.sessionId || genId(),
    topic: snap.topic,
    command: snap.command,
    debateEngine: snap.debateEngine,
    verifyEngine: snap.verifyEngine,
    techSpec: snap.techSpec || undefined,
    modeInput: snap.modeInput || undefined,
    recommendation: snap.recommendation,
    confirmedRoles: snap.confirmedRoles,
    messages: snap.messages,
    verificationProvider: snap.verificationProvider,
    verificationResult: snap.verificationResult,
    prd: snap.prd,
    prdRevisions: snap.prdRevisions,
    revisionCount: snap.revisionCount,
    feedbacks: snap.feedbacks,
    clarifications: snap.clarifications || undefined,
    clarificationRound: snap.clarificationRound || undefined,
    harness: snap.harness || undefined,
    activeWorkflow: snap.activeWorkflow || undefined,
    generatedCommand: snap.generatedCommand || undefined,
    prototypeHtml: snap.prototypeHtml || undefined,
    status: statusOverride || snap.status,
    createdAt: snap.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function serializeRecommendationPayload(
  recommendation: Session["recommendation"],
  harness?: Session["harness"],
  activeWorkflow?: ActiveWorkflow,
): RecommendationPayload | Recommendation | null {
  if (!harness) {
    return recommendation ? { ...recommendation } : null;
  }

  return {
    ...(recommendation ? { ...recommendation } : {}),
    _harness: harness,
    _activeWorkflow: activeWorkflow || "plan_harness",
  };
}

export function deserializeRecommendationPayload(
  payload: unknown,
): {
  recommendation: Recommendation | null;
  harness?: Session["harness"];
  activeWorkflow?: ActiveWorkflow;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { recommendation: null };
  }

  const record = payload as RecommendationPayload;
  const harness = record._harness;
  const activeWorkflow = record._activeWorkflow;
  const { _harness, _activeWorkflow, ...rest } = record;

  return {
    recommendation: Object.keys(rest).length > 0 ? (rest as unknown as Recommendation) : null,
    harness,
    activeWorkflow,
  };
}

export function buildSessionRow(
  session: Session,
  options: BuildSessionRowOptions = {},
): SessionRow {
  const harnessStorage = options.harnessStorage || "dedicated";

  return {
    id: session.id,
    mode: session.command || "debate",
    topic: session.topic,
    engine_model: session.debateEngine || "claude-sonnet",
    reviewer_model: session.verifyEngine || "chatgpt",
    roles: session.confirmedRoles || [],
    messages: session.messages || [],
    prd: session.prd || "",
    html_ui: session.prototypeHtml || "",
    claude_command: session.generatedCommand || "",
    status: session.status || "idle",
    recommendation: harnessStorage === "legacy"
      ? serializeRecommendationPayload(
          session.recommendation,
          session.harness,
          session.activeWorkflow,
        )
      : session.recommendation
      ? { ...session.recommendation }
      : null,
    harness_data: harnessStorage === "dedicated" ? session.harness || null : null,
    active_workflow: harnessStorage === "dedicated"
      ? session.activeWorkflow || (session.harness ? "plan_harness" : null)
      : null,
    verification_provider: session.verificationProvider || "",
    verification_result: session.verificationResult || "",
    prd_revisions: session.prdRevisions || [],
    revision_count: session.revisionCount || 0,
    feedbacks: session.feedbacks || [],
    mode_input: session.modeInput || null,
    created_at: session.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export type HarnessRestoreSource = "dedicated" | "legacy" | "none";

export function detectHarnessRestoreSource(row: SessionRow): HarnessRestoreSource {
  if (row.harness_data) return "dedicated";
  const rec = row.recommendation as RecommendationPayload | null;
  if (rec && typeof rec === "object" && "_harness" in rec) return "legacy";
  return "none";
}

export function mapRowToSession(row: SessionRow, techSpec: string): Session {
  const restored = deserializeRecommendationPayload(row.recommendation);
  const harness = row.harness_data ?? restored.harness;
  const activeWorkflow = row.active_workflow ?? restored.activeWorkflow;

  return {
    id: row.id,
    topic: row.topic,
    command: row.mode || "debate",
    debateEngine: row.engine_model,
    verifyEngine: row.reviewer_model,
    techSpec: techSpec || undefined,
    modeInput: row.mode_input || undefined,
    recommendation: restored.recommendation,
    confirmedRoles: row.roles || [],
    messages: row.messages || [],
    verificationProvider: row.verification_provider || null,
    verificationResult: row.verification_result || "",
    prd: row.prd || "",
    prdRevisions: row.prd_revisions || [],
    revisionCount: row.revision_count || 0,
    feedbacks: row.feedbacks || [],
    generatedCommand: row.claude_command || undefined,
    prototypeHtml: row.html_ui || undefined,
    harness,
    activeWorkflow,
    status: row.status || "complete",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
