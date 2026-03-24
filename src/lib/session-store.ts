import { Session, SessionSummary } from "./types";
import { getDb, migrateJsonFiles } from "./db";

let migrated = false;

async function ensureMigrated() {
  if (!migrated) {
    await migrateJsonFiles();
    migrated = true;
  }
}

// ===== Save / Update Session =====
export async function saveSession(session: Session): Promise<void> {
  await ensureMigrated();
  const db = getDb();

  const upsert = db.prepare(`
    INSERT INTO debates (
      id, mode, topic, engine_model, reviewer_model, roles, messages,
      prd, html_ui, claude_command, status, recommendation,
      verification_provider, verification_result, prd_revisions,
      revision_count, feedbacks, mode_input, created_at, updated_at
    ) VALUES (
      @id, @mode, @topic, @engine_model, @reviewer_model, @roles, @messages,
      @prd, @html_ui, @claude_command, @status, @recommendation,
      @verification_provider, @verification_result, @prd_revisions,
      @revision_count, @feedbacks, @mode_input, @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      mode = @mode, topic = @topic, engine_model = @engine_model,
      reviewer_model = @reviewer_model, roles = @roles, messages = @messages,
      prd = @prd, html_ui = @html_ui, claude_command = @claude_command,
      status = @status, recommendation = @recommendation,
      verification_provider = @verification_provider,
      verification_result = @verification_result,
      prd_revisions = @prd_revisions, revision_count = @revision_count,
      feedbacks = @feedbacks, mode_input = @mode_input,
      updated_at = @updated_at
  `);

  upsert.run({
    id: session.id,
    mode: session.command || "debate",
    topic: session.topic,
    engine_model: session.debateEngine || "claude-sonnet",
    reviewer_model: session.verifyEngine || "chatgpt",
    roles: JSON.stringify(session.confirmedRoles || []),
    messages: JSON.stringify(session.messages || []),
    prd: session.prd || "",
    html_ui: session.prototypeHtml || "",
    claude_command: session.generatedCommand || "",
    status: session.status || "idle",
    recommendation: session.recommendation ? JSON.stringify(session.recommendation) : "",
    verification_provider: session.verificationProvider || "",
    verification_result: session.verificationResult || "",
    prd_revisions: JSON.stringify(session.prdRevisions || []),
    revision_count: session.revisionCount || 0,
    feedbacks: JSON.stringify(session.feedbacks || []),
    mode_input: session.modeInput ? JSON.stringify(session.modeInput) : "",
    created_at: session.createdAt || new Date().toISOString(),
    updated_at: session.updatedAt || new Date().toISOString(),
  });

  // Save tech spec if present
  if (session.techSpec) {
    const upsertSpec = db.prepare(`
      INSERT INTO tech_specs (id, debate_id, content, created_at)
      VALUES (@id, @debate_id, @content, @created_at)
      ON CONFLICT(id) DO UPDATE SET content = @content
    `);
    upsertSpec.run({
      id: `ts_${session.id}`,
      debate_id: session.id,
      content: session.techSpec,
      created_at: session.createdAt || new Date().toISOString(),
    });
  }
}

// ===== Save UI Version =====
export async function saveUiVersion(
  debateId: string,
  htmlCode: string,
  modificationRequest: string = "",
): Promise<void> {
  await ensureMigrated();
  const db = getDb();

  // Get next version number
  const row = db
    .prepare("SELECT MAX(version) as maxVer FROM ui_versions WHERE debate_id = ?")
    .get(debateId) as any;
  const nextVersion = (row?.maxVer || 0) + 1;

  db.prepare(`
    INSERT INTO ui_versions (id, debate_id, version, html_code, modification_request, created_at)
    VALUES (@id, @debate_id, @version, @html_code, @modification_request, @created_at)
  `).run({
    id: `uiv_${debateId}_${nextVersion}`,
    debate_id: debateId,
    version: nextVersion,
    html_code: htmlCode,
    modification_request: modificationRequest,
    created_at: new Date().toISOString(),
  });
}

// ===== Load Session =====
export async function loadSession(id: string): Promise<Session | null> {
  await ensureMigrated();
  const db = getDb();

  const row = db.prepare("SELECT * FROM debates WHERE id = ?").get(id) as any;
  if (!row) return null;

  const techSpec = db
    .prepare("SELECT content FROM tech_specs WHERE debate_id = ? LIMIT 1")
    .get(id) as any;

  return rowToSession(row, techSpec?.content || "");
}

// ===== List Sessions =====
export async function listSessions(): Promise<SessionSummary[]> {
  await ensureMigrated();
  const db = getDb();

  const rows = db
    .prepare("SELECT * FROM debates ORDER BY updated_at DESC")
    .all() as any[];

  return rows.map((row) => {
    const messages = safeJson(row.messages, []);
    let prdPreview = "";
    if (row.prd) {
      const lines = row.prd.split("\n").filter((l: string) => l.trim() && !l.startsWith("#"));
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
  await ensureMigrated();
  const db = getDb();

  const result = db.prepare("DELETE FROM debates WHERE id = ?").run(id);
  return result.changes > 0;
}

// ===== Search Sessions =====
export async function searchSessions(query: {
  text?: string;
  mode?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<SessionSummary[]> {
  await ensureMigrated();
  const db = getDb();

  let sql = "SELECT * FROM debates WHERE 1=1";
  const params: any[] = [];

  if (query.text) {
    // Use FTS5 for text search
    const ftsIds = db
      .prepare("SELECT rowid FROM debates_fts WHERE debates_fts MATCH ?")
      .all(query.text + "*") as any[];

    if (ftsIds.length === 0) {
      // Fallback: LIKE search on topic
      sql += " AND topic LIKE ?";
      params.push(`%${query.text}%`);
    } else {
      const rowids = ftsIds.map((r: any) => r.rowid);
      sql += ` AND rowid IN (${rowids.join(",")})`;
    }
  }

  if (query.mode) {
    sql += " AND mode = ?";
    params.push(query.mode);
  }

  if (query.dateFrom) {
    sql += " AND created_at >= ?";
    params.push(query.dateFrom);
  }

  if (query.dateTo) {
    sql += " AND created_at <= ?";
    params.push(query.dateTo + "T23:59:59Z");
  }

  sql += " ORDER BY updated_at DESC LIMIT 50";

  const rows = db.prepare(sql).all(...params) as any[];

  return rows.map((row) => {
    const messages = safeJson(row.messages, []);
    let prdPreview = "";
    if (row.prd) {
      const lines = row.prd.split("\n").filter((l: string) => l.trim() && !l.startsWith("#"));
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
  excludeId?: string,
): Promise<SessionSummary[]> {
  await ensureMigrated();
  const db = getDb();

  // Extract keywords from topic (3+ char words)
  const keywords = topic
    .replace(/[^\w\s가-힣]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 5);

  if (keywords.length === 0) return [];

  // Try FTS match first
  const ftsQuery = keywords.join(" OR ");
  try {
    let sql = `
      SELECT d.*, rank
      FROM debates_fts fts
      JOIN debates d ON d.rowid = fts.rowid
      WHERE debates_fts MATCH ?
    `;
    const params: any[] = [ftsQuery];

    if (excludeId) {
      sql += " AND d.id != ?";
      params.push(excludeId);
    }

    sql += " ORDER BY rank LIMIT 5";

    const rows = db.prepare(sql).all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      topic: row.topic,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revisionCount: row.revision_count || 0,
      messageCount: safeJson(row.messages, []).length,
      status: row.status || "complete",
      command: row.mode,
    }));
  } catch {
    // FTS might fail with special characters; fallback to LIKE
    const likePattern = `%${keywords[0]}%`;
    let sql = "SELECT * FROM debates WHERE topic LIKE ?";
    const params: any[] = [likePattern];

    if (excludeId) {
      sql += " AND id != ?";
      params.push(excludeId);
    }

    sql += " ORDER BY updated_at DESC LIMIT 5";

    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map((row) => ({
      id: row.id,
      topic: row.topic,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revisionCount: row.revision_count || 0,
      messageCount: safeJson(row.messages, []).length,
      status: row.status || "complete",
      command: row.mode,
    }));
  }
}

// ===== Get UI Versions =====
export async function getUiVersions(debateId: string) {
  await ensureMigrated();
  const db = getDb();

  return db
    .prepare("SELECT * FROM ui_versions WHERE debate_id = ? ORDER BY version ASC")
    .all(debateId) as any[];
}

// ===== Helpers =====
function safeJson(val: string, fallback: any): any {
  if (!val) return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function rowToSession(row: any, techSpec: string): Session {
  return {
    id: row.id,
    topic: row.topic,
    command: row.mode || "debate",
    debateEngine: row.engine_model,
    verifyEngine: row.reviewer_model,
    techSpec: techSpec || undefined,
    modeInput: safeJson(row.mode_input, null) || undefined,
    recommendation: safeJson(row.recommendation, null),
    confirmedRoles: safeJson(row.roles, []),
    messages: safeJson(row.messages, []),
    verificationProvider: row.verification_provider || null,
    verificationResult: row.verification_result || "",
    prd: row.prd || "",
    prdRevisions: safeJson(row.prd_revisions, []),
    revisionCount: row.revision_count || 0,
    feedbacks: safeJson(row.feedbacks, []),
    generatedCommand: row.claude_command || undefined,
    prototypeHtml: row.html_ui || undefined,
    status: row.status || "complete",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
