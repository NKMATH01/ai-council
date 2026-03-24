import { Session, SessionSummary } from "./types";
import { getSupabase } from "./db";

// ===== Save / Update Session =====
export async function saveSession(session: Session): Promise<void> {
  const row = {
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
    recommendation: session.recommendation || null,
    verification_provider: session.verificationProvider || "",
    verification_result: session.verificationResult || "",
    prd_revisions: session.prdRevisions || [],
    revision_count: session.revisionCount || 0,
    feedbacks: session.feedbacks || [],
    mode_input: session.modeInput || null,
    created_at: session.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await getSupabase()
    .from("debates")
    .upsert(row, { onConflict: "id" });

  if (error) throw new Error(`saveSession failed: ${error.message}`);

  // Save tech spec if present
  if (session.techSpec) {
    const { error: specError } = await getSupabase()
      .from("tech_specs")
      .upsert(
        {
          id: `ts_${session.id}`,
          debate_id: session.id,
          content: session.techSpec,
          created_at: session.createdAt || new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    if (specError) throw new Error(`saveTechSpec failed: ${specError.message}`);
  }
}

// ===== Save UI Version =====
export async function saveUiVersion(
  debateId: string,
  htmlCode: string,
  modificationRequest: string = ""
): Promise<void> {
  // Get next version number
  const { data: maxRow } = await getSupabase()
    .from("ui_versions")
    .select("version")
    .eq("debate_id", debateId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (maxRow?.version || 0) + 1;

  const { error } = await getSupabase().from("ui_versions").insert({
    id: `uiv_${debateId}_${nextVersion}`,
    debate_id: debateId,
    version: nextVersion,
    html_code: htmlCode,
    modification_request: modificationRequest,
    created_at: new Date().toISOString(),
  });

  if (error) throw new Error(`saveUiVersion failed: ${error.message}`);
}

// ===== Load Session =====
export async function loadSession(id: string): Promise<Session | null> {
  const { data: row, error } = await getSupabase()
    .from("debates")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !row) return null;

  const { data: specRow } = await getSupabase()
    .from("tech_specs")
    .select("content")
    .eq("debate_id", id)
    .limit(1)
    .single();

  return rowToSession(row, specRow?.content || "");
}

// ===== List Sessions =====
export async function listSessions(): Promise<SessionSummary[]> {
  const { data: rows, error } = await getSupabase()
    .from("debates")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error || !rows) return [];

  return rows.map((row) => {
    const messages = row.messages || [];
    let prdPreview = "";
    if (row.prd) {
      const lines = row.prd
        .split("\n")
        .filter((l: string) => l.trim() && !l.startsWith("#"));
      prdPreview = (lines[0] || "").substring(0, 80);
    }
    return {
      id: row.id,
      topic: row.topic,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revisionCount: row.revision_count || 0,
      messageCount: messages.length,
      status: row.status || "complete",
      prdPreview,
      command: row.mode,
    };
  });
}

// ===== Delete Session =====
export async function deleteSession(id: string): Promise<boolean> {
  const { error, count } = await getSupabase()
    .from("debates")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return false;
  return (count || 0) > 0;
}

// ===== Search Sessions =====
export async function searchSessions(query: {
  text?: string;
  mode?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<SessionSummary[]> {
  let q = getSupabase()
    .from("debates")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (query.text) {
    // PostgreSQL full-text search
    const tsQuery = query.text
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .map((w) => `'${w}'`)
      .join(" | ");

    if (tsQuery) {
      q = q.textSearch("fts", tsQuery);
    }
  }

  if (query.mode) {
    q = q.eq("mode", query.mode);
  }

  if (query.dateFrom) {
    q = q.gte("created_at", query.dateFrom);
  }

  if (query.dateTo) {
    q = q.lte("created_at", query.dateTo + "T23:59:59Z");
  }

  const { data: rows, error } = await q;

  if (error || !rows) return [];

  return rows.map((row) => {
    const messages = row.messages || [];
    let prdPreview = "";
    if (row.prd) {
      const lines = row.prd
        .split("\n")
        .filter((l: string) => l.trim() && !l.startsWith("#"));
      prdPreview = (lines[0] || "").substring(0, 80);
    }
    return {
      id: row.id,
      topic: row.topic,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revisionCount: row.revision_count || 0,
      messageCount: messages.length,
      status: row.status || "complete",
      prdPreview,
      command: row.mode,
    };
  });
}

// ===== Find Similar Debates =====
export async function findSimilarDebates(
  topic: string,
  excludeId?: string
): Promise<SessionSummary[]> {
  const keywords = topic
    .replace(/[^\w\s가-힣]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 5);

  if (keywords.length === 0) return [];

  const tsQuery = keywords.map((w) => `'${w}'`).join(" | ");

  let q = getSupabase()
    .from("debates")
    .select("*")
    .textSearch("fts", tsQuery)
    .limit(5);

  if (excludeId) {
    q = q.neq("id", excludeId);
  }

  const { data: rows, error } = await q;

  if (error || !rows) return [];

  return rows.map((row) => ({
    id: row.id,
    topic: row.topic,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revisionCount: row.revision_count || 0,
    messageCount: (row.messages || []).length,
    status: row.status || "complete",
    command: row.mode,
  }));
}

// ===== Get UI Versions =====
export async function getUiVersions(debateId: string) {
  const { data, error } = await getSupabase()
    .from("ui_versions")
    .select("*")
    .eq("debate_id", debateId)
    .order("version", { ascending: true });

  if (error) return [];
  return data || [];
}

// ===== Helpers =====
function rowToSession(row: any, techSpec: string): Session {
  return {
    id: row.id,
    topic: row.topic,
    command: row.mode || "debate",
    debateEngine: row.engine_model,
    verifyEngine: row.reviewer_model,
    techSpec: techSpec || undefined,
    modeInput: row.mode_input || undefined,
    recommendation: row.recommendation || null,
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
    status: row.status || "complete",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
