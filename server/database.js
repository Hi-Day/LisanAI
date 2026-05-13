const fs = require("node:fs");
const path = require("node:path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const { ROOT } = require("./config");

const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "oralai.db");

let db;

async function initDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });
  await db.exec("PRAGMA foreign_keys = ON");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      final_score INTEGER NOT NULL,
      payload TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
    );
  `);
}

function getDb() {
  if (!db) throw new Error("Database belum siap");
  return db;
}

async function getState() {
  const database = getDb();
  const assessments = await database.all("SELECT payload FROM assessments ORDER BY datetime(created_at) DESC");
  const submissions = await database.all("SELECT payload FROM submissions ORDER BY datetime(submitted_at) ASC");
  return {
    assessments: assessments.map((row) => JSON.parse(row.payload)),
    submissions: submissions.map((row) => JSON.parse(row.payload)),
  };
}

async function saveAssessment(assessment) {
  await getDb().run(
    `INSERT OR REPLACE INTO assessments (id, topic, difficulty, payload, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    assessment.id,
    assessment.topic,
    assessment.difficulty,
    JSON.stringify(assessment),
    assessment.createdAt
  );
  return assessment;
}

async function saveSubmission(submission) {
  await getDb().run(
    `INSERT OR REPLACE INTO submissions (id, assessment_id, student_name, final_score, payload, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    submission.id,
    submission.assessmentId,
    submission.studentName,
    submission.finalScore,
    JSON.stringify(submission),
    submission.submittedAt
  );
  return submission;
}

async function clearData() {
  const database = getDb();
  await database.run("DELETE FROM submissions");
  await database.run("DELETE FROM assessments");
}

module.exports = {
  DB_PATH,
  clearData,
  getState,
  initDatabase,
  saveAssessment,
  saveSubmission,
};
