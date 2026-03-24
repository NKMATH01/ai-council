import Database from "better-sqlite3";
import path from "path";
import { promises as fs, readFileSync } from "fs";

const DB_PATH = path.join(process.cwd(), "data", "council.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initSchema(db);
  return db;
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS debates (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL DEFAULT 'debate',
      topic TEXT NOT NULL,
      engine_model TEXT DEFAULT 'claude-sonnet-4-6',
      reviewer_model TEXT DEFAULT 'chatgpt',
      roles TEXT DEFAULT '[]',
      messages TEXT DEFAULT '[]',
      prd TEXT DEFAULT '',
      html_ui TEXT DEFAULT '',
      claude_command TEXT DEFAULT '',
      status TEXT DEFAULT 'idle',
      recommendation TEXT DEFAULT '',
      verification_provider TEXT DEFAULT '',
      verification_result TEXT DEFAULT '',
      prd_revisions TEXT DEFAULT '[]',
      revision_count INTEGER DEFAULT 0,
      feedbacks TEXT DEFAULT '[]',
      mode_input TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tech_specs (
      id TEXT PRIMARY KEY,
      debate_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ui_versions (
      id TEXT PRIMARY KEY,
      debate_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      html_code TEXT NOT NULL,
      modification_request TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_debates_topic ON debates(topic);
    CREATE INDEX IF NOT EXISTS idx_debates_mode ON debates(mode);
    CREATE INDEX IF NOT EXISTS idx_debates_status ON debates(status);
    CREATE INDEX IF NOT EXISTS idx_debates_created ON debates(created_at);
    CREATE INDEX IF NOT EXISTS idx_tech_specs_debate ON tech_specs(debate_id);
    CREATE INDEX IF NOT EXISTS idx_ui_versions_debate ON ui_versions(debate_id);
  `);

  // FTS5 for full-text search (topic + prd)
  database.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS debates_fts USING fts5(
      topic, prd, content='debates', content_rowid='rowid'
    );
  `);

  // Triggers to keep FTS in sync
  const triggerExists = database
    .prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='debates_ai'")
    .get();

  if (!triggerExists) {
    database.exec(`
      CREATE TRIGGER debates_ai AFTER INSERT ON debates BEGIN
        INSERT INTO debates_fts(rowid, topic, prd) VALUES (new.rowid, new.topic, new.prd);
      END;
      CREATE TRIGGER debates_ad AFTER DELETE ON debates BEGIN
        INSERT INTO debates_fts(debates_fts, rowid, topic, prd) VALUES('delete', old.rowid, old.topic, old.prd);
      END;
      CREATE TRIGGER debates_au AFTER UPDATE ON debates BEGIN
        INSERT INTO debates_fts(debates_fts, rowid, topic, prd) VALUES('delete', old.rowid, old.topic, old.prd);
        INSERT INTO debates_fts(rowid, topic, prd) VALUES (new.rowid, new.topic, new.prd);
      END;
    `);
  }
}

// ===== Migrate existing JSON files to SQLite =====
export async function migrateJsonFiles() {
  const sessionsDir = path.join(process.cwd(), "data", "sessions");
  try {
    const files = await fs.readdir(sessionsDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    if (jsonFiles.length === 0) return;

    const database = getDb();
    const existingCount = (database.prepare("SELECT COUNT(*) as cnt FROM debates").get() as any).cnt;
    if (existingCount > 0) return; // already migrated

    const insert = database.prepare(`
      INSERT OR IGNORE INTO debates (
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
    `);

    const insertTechSpec = database.prepare(`
      INSERT OR IGNORE INTO tech_specs (id, debate_id, content, created_at)
      VALUES (@id, @debate_id, @content, @created_at)
    `);

    const transaction = database.transaction(() => {
      for (const file of jsonFiles) {
        try {
          const raw = JSON.parse(readFileSync(path.join(sessionsDir, file), "utf-8"));
          insert.run({
            id: raw.id,
            mode: raw.command || "debate",
            topic: raw.topic || "",
            engine_model: raw.debateEngine || "claude-sonnet-4-6",
            reviewer_model: raw.verifyEngine || "chatgpt",
            roles: JSON.stringify(raw.confirmedRoles || []),
            messages: JSON.stringify(raw.messages || []),
            prd: raw.prd || "",
            html_ui: raw.prototypeHtml || "",
            claude_command: raw.generatedCommand || "",
            status: raw.status || "complete",
            recommendation: raw.recommendation ? JSON.stringify(raw.recommendation) : "",
            verification_provider: raw.verificationProvider || "",
            verification_result: raw.verificationResult || "",
            prd_revisions: JSON.stringify(raw.prdRevisions || []),
            revision_count: raw.revisionCount || 0,
            feedbacks: JSON.stringify(raw.feedbacks || []),
            mode_input: raw.modeInput ? JSON.stringify(raw.modeInput) : "",
            created_at: raw.createdAt || new Date().toISOString(),
            updated_at: raw.updatedAt || new Date().toISOString(),
          });

          if (raw.techSpec) {
            insertTechSpec.run({
              id: `ts_${raw.id}`,
              debate_id: raw.id,
              content: raw.techSpec,
              created_at: raw.createdAt || new Date().toISOString(),
            });
          }
        } catch {
          // skip malformed files
        }
      }
    });

    transaction();
    console.log(`Migrated ${jsonFiles.length} session files to SQLite`);
  } catch {
    // sessions dir might not exist yet
  }
}
