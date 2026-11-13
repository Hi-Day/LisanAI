// One-time move of recordings stored inside submission payloads (before migration 026)
// into the submission_audio table. Safe to run again: moved rows no longer match.
// Usage: npm run migrate:audio
const { loadEnv } = require("../server/config");
const { initDatabase, getDb } = require("../server/database");

async function main() {
  loadEnv();
  await initDatabase();
  const db = getDb();
  // Ids first, then one payload at a time: legacy payloads can be several megabytes each.
  const ids = await db.all("SELECT id FROM submissions WHERE payload LIKE '%\"audio\":\"data:audio/%'");
  let moved = 0;
  for (const { id } of ids) {
    const row = await db.get("SELECT tenant_id, payload FROM submissions WHERE id = ?", id);
    const payload = JSON.parse(row.payload);
    const statements = [];
    (payload.questionScores || []).forEach((item, index) => {
      if (!item) return;
      for (const [kind, holder] of [["main", item], ["probing", item.probing]]) {
        if (!holder || typeof holder.audio !== "string") continue;
        statements.push([
          "INSERT OR IGNORE INTO submission_audio (submission_id, tenant_id, question_index, kind, audio, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          id, row.tenant_id, index, kind, holder.audio, payload.submittedAt || new Date().toISOString(),
        ]);
        delete holder.audio;
        holder.hasAudio = true;
      }
    });
    if (!statements.length) continue;
    // Copy and strip in one transaction, so a recording is never in neither place.
    statements.push(["UPDATE submissions SET payload = ? WHERE id = ?", JSON.stringify(payload), id]);
    await db.batch(statements);
    moved += statements.length - 1;
  }
  console.log(`Moved ${moved} recordings from ${ids.length} submissions.`);
}

main().catch((error) => {
  console.error("Audio migration failed:", error.message);
  process.exit(1);
});
