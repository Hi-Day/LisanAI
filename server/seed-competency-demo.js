const { getDb } = require("./database");

const DEMO_TOPICS = [
  "Perkenalan Diri dalam Bahasa Inggris",
  "Fotosintesis dan Aliran Energi",
  "Debat: Dampak Media Sosial",
];

// These are intentionally stable across assessments so the trajectory engine
// can aggregate repeated observations of the same competency over time.
const LEARNING_OUTCOMES = [
  {
    id: "LO-DEMO-01",
    text: "Menjelaskan konsep utama secara tepat dan menggunakan istilah kunci yang relevan.",
  },
  {
    id: "LO-DEMO-02",
    text: "Menjelaskan hubungan sebab-akibat dan memberikan alasan yang logis berdasarkan konsep.",
  },
  {
    id: "LO-DEMO-03",
    text: "Menyampaikan gagasan secara runtut, jelas, dan santun dalam komunikasi lisan.",
  },
];

const QUESTION_LOS = {
  "Perkenalan Diri dalam Bahasa Inggris": ["LO-DEMO-03", "LO-DEMO-03", "LO-DEMO-01"],
  "Fotosintesis dan Aliran Energi": ["LO-DEMO-01", "LO-DEMO-02", "LO-DEMO-02"],
  "Debat: Dampak Media Sosial": ["LO-DEMO-03", "LO-DEMO-02", "LO-DEMO-03"],
};

const LO_BY_ID = new Map(LEARNING_OUTCOMES.map((lo) => [lo.id, lo]));

function parse(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function enrichAssessment(payload) {
  const los = LEARNING_OUTCOMES.filter((lo) =>
    (QUESTION_LOS[payload.topic] || []).some((id) => id === lo.id)
  );
  const mapping = QUESTION_LOS[payload.topic] || [];
  const questions = (payload.questions || []).map((question, index) => {
    const ids = [mapping[index]].filter(Boolean);
    return {
      ...question,
      learningOutcomeIds: ids,
      learningOutcomeId: ids[0] || null,
      outcome: ids.map((id) => LO_BY_ID.get(id)?.text).filter(Boolean).join("; "),
    };
  });
  return {
    ...payload,
    outcomes: los,
    learningOutcomes: los,
    questions,
  };
}

function enrichSubmission(payload, assessmentPayload) {
  const mapping = QUESTION_LOS[assessmentPayload.topic] || [];
  const questionScores = (payload.questionScores || []).map((score, index) => {
    const ids = [mapping[index]].filter(Boolean);
    return {
      ...score,
      learningOutcomeIds: ids,
      learningOutcomeId: ids[0] || null,
    };
  });
  return { ...payload, questionScores };
}

async function seedCompetencyDemoData(auth) {
  const db = getDb();
  const tenantId = auth.tenant.id;
  const teacherScope = auth.user.role === "teacher" ? " AND teacher_id = ?" : "";
  const params = auth.user.role === "teacher" ? [tenantId, auth.user.id, ...DEMO_TOPICS] : [tenantId, ...DEMO_TOPICS];

  const assessments = await db.all(
    `SELECT id, topic, teacher_id, payload FROM assessments
     WHERE tenant_id = ?${teacherScope}
       AND topic IN (${DEMO_TOPICS.map(() => "?").join(",")})`,
    ...params
  );

  let assessmentsUpdated = 0;
  let submissionsUpdated = 0;
  const assessmentIds = [];

  for (const row of assessments) {
    const current = parse(row.payload);
    if (!current.topic || !QUESTION_LOS[current.topic]) continue;
    const enriched = enrichAssessment(current);
    await db.run(
      "UPDATE assessments SET payload = ? WHERE id = ? AND tenant_id = ?",
      JSON.stringify(enriched),
      row.id,
      tenantId
    );
    assessmentIds.push(row.id);
    assessmentsUpdated += 1;

    const submissions = await db.all(
      "SELECT id, payload FROM submissions WHERE tenant_id = ? AND assessment_id = ?",
      tenantId,
      row.id
    );
    for (const submission of submissions) {
      const updated = enrichSubmission(parse(submission.payload), enriched);
      await db.run(
        "UPDATE submissions SET payload = ? WHERE id = ? AND tenant_id = ?",
        JSON.stringify(updated),
        submission.id,
        tenantId
      );
      submissionsUpdated += 1;
    }
  }

  return {
    assessmentsUpdated,
    submissionsUpdated,
    assessmentIds,
    learningOutcomes: LEARNING_OUTCOMES,
  };
}

module.exports = { seedCompetencyDemoData, LEARNING_OUTCOMES };
