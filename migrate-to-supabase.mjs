import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const SUPABASE_URL = "https://cfvlxlniloxjriaaqzhx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmdmx4bG5pbG94anJpYWFxemh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg5MjM1OCwiZXhwIjoyMDg4NDY4MzU4fQ.osZQ2nL7bb-PeQg8IAeey__KC4GJMdYeyGU0KTr99MM";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sessionsDir = path.join(process.cwd(), "data", "sessions");

async function migrate() {
  const files = readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} session files to migrate`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    try {
      const raw = JSON.parse(readFileSync(path.join(sessionsDir, file), "utf-8"));

      const row = {
        id: raw.id,
        mode: raw.command || "debate",
        topic: raw.topic || "",
        engine_model: raw.debateEngine || "claude-sonnet-4-6",
        reviewer_model: raw.verifyEngine || "chatgpt",
        roles: raw.confirmedRoles || [],
        messages: raw.messages || [],
        prd: raw.prd || "",
        html_ui: raw.prototypeHtml || "",
        claude_command: raw.generatedCommand || "",
        status: raw.status || "complete",
        recommendation: raw.recommendation || null,
        verification_provider: raw.verificationProvider || "",
        verification_result: raw.verificationResult || "",
        prd_revisions: raw.prdRevisions || [],
        revision_count: raw.revisionCount || 0,
        feedbacks: raw.feedbacks || [],
        mode_input: raw.modeInput || null,
        created_at: raw.createdAt || new Date().toISOString(),
        updated_at: raw.updatedAt || new Date().toISOString(),
      };

      const { error } = await supabase
        .from("debates")
        .upsert(row, { onConflict: "id" });

      if (error) {
        console.error(`FAIL [${raw.id}]: ${error.message}`);
        failed++;
        continue;
      }

      // Migrate tech spec if present
      if (raw.techSpec) {
        await supabase.from("tech_specs").upsert(
          {
            id: `ts_${raw.id}`,
            debate_id: raw.id,
            content: raw.techSpec,
            created_at: raw.createdAt || new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      }

      success++;
      console.log(`OK [${raw.id}] ${raw.topic?.substring(0, 50)}...`);
    } catch (e) {
      console.error(`FAIL [${file}]: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nMigration complete: ${success} success, ${failed} failed`);
}

migrate();
