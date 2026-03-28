import { getSupabase } from "./db";
import { buildSessionRow, mapRowToSession, SessionRow } from "./session-mappers";
import { Session, SessionSummary } from "./types";

export type SaveStorageMode = "dedicated" | "legacy";

export async function saveSession(session: Session): Promise<{ storageMode: SaveStorageMode }> {
  let storageMode: SaveStorageMode = "dedicated";
  let row = buildSessionRow(session);
  let { error } = await upsertDebateRow(row);

  // 점진적 fallback: 없는 컬럼을 하나씩 제거하며 재시도
  if (error && isMissingHarnessStorageColumnError(error.message)) {
    storageMode = "legacy";
    console.warn("[session-store] harness columns not found, falling back to legacy");
    row = buildSessionRow(session, { harnessStorage: "legacy" });
    ({ error } = await upsertDebateRow(row));
  }

  if (error && isMissingColumnError(error.message, "clarification")) {
    console.warn("[session-store] clarification columns not found, saving without");
    const { clarifications: _, clarification_round: __, ...stripped } = row;
    row = stripped as SessionRow;
    ({ error } = await upsertDebateRow(row));
  }

  if (error) throw new Error(`saveSession failed: ${error.message}`);

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
        { onConflict: "id" },
      );

    if (specError) throw new Error(`saveTechSpec failed: ${specError.message}`);
  }

  return { storageMode };
}

export async function saveUiVersion(
  debateId: string,
  htmlCode: string,
  modificationRequest: string = "",
): Promise<void> {
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

  return rowToSession(row as SessionRow, specRow?.content || "");
}

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
        .filter((line: string) => line.trim() && !line.startsWith("#"));
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

export async function deleteSession(id: string): Promise<boolean> {
  const { error, count } = await getSupabase()
    .from("debates")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return false;
  return (count || 0) > 0;
}

export async function searchSessions(query: {
  text?: string;
  mode?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<SessionSummary[]> {
  let request = getSupabase()
    .from("debates")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (query.text) {
    const tsQuery = query.text
      .split(/\s+/)
      .filter((word) => word.length >= 2)
      .map((word) => `'${word}'`)
      .join(" | ");

    if (tsQuery) {
      request = request.textSearch("fts", tsQuery);
    }
  }

  if (query.mode) {
    request = request.eq("mode", query.mode);
  }

  if (query.dateFrom) {
    request = request.gte("created_at", query.dateFrom);
  }

  if (query.dateTo) {
    request = request.lte("created_at", `${query.dateTo}T23:59:59Z`);
  }

  const { data: rows, error } = await request;

  if (error || !rows) return [];

  return rows.map((row) => {
    const messages = row.messages || [];
    let prdPreview = "";

    if (row.prd) {
      const lines = row.prd
        .split("\n")
        .filter((line: string) => line.trim() && !line.startsWith("#"));
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

export async function findSimilarDebates(
  topic: string,
  excludeId?: string,
): Promise<SessionSummary[]> {
  const keywords = topic
    .replace(/[^\w\s가-힣]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 2)
    .slice(0, 5);

  if (keywords.length === 0) return [];

  const tsQuery = keywords.map((word) => `'${word}'`).join(" | ");

  let request = getSupabase()
    .from("debates")
    .select("*")
    .textSearch("fts", tsQuery)
    .limit(5);

  if (excludeId) {
    request = request.neq("id", excludeId);
  }

  const { data: rows, error } = await request;

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

export async function getUiVersions(debateId: string) {
  const { data, error } = await getSupabase()
    .from("ui_versions")
    .select("*")
    .eq("debate_id", debateId)
    .order("version", { ascending: true });

  if (error) return [];
  return data || [];
}

function rowToSession(row: SessionRow, techSpec: string): Session {
  return mapRowToSession(row, techSpec);
}

async function upsertDebateRow(row: SessionRow) {
  return getSupabase()
    .from("debates")
    .upsert(row, { onConflict: "id" });
}

function isMissingHarnessStorageColumnError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("harness_data") || normalized.includes("active_workflow");
}

function isMissingColumnError(message: string, columnHint: string) {
  const normalized = message.toLowerCase();
  return normalized.includes(columnHint.toLowerCase()) &&
    (normalized.includes("column") || normalized.includes("undefined") || normalized.includes("not exist"));
}
