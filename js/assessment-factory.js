import { uid } from "./utils.js";

export function readAssessmentForm(els) {
  return {
    id: uid("assess"),
    topic: els.topic.value.trim(),
    outcomes: els.outcomes.value.trim(),
    rubric: els.rubric.value.trim(),
    difficulty: els.difficulty.value,
    examples: els.examples.value.trim(),
    count: Number(els.questionCount.value),
    createdAt: new Date().toISOString(),
  };
}

export function createAssessment(config, questions) {
  const { count, ...assessment } = config;
  return {
    ...assessment,
    questions,
  };
}

export function createDemoAssessment(generateQuestions) {
  const config = {
    id: uid("assess"),
    topic: "Fotosintesis dan aliran energi",
    outcomes: "Siswa mampu menjelaskan proses fotosintesis, hubungan cahaya dengan pembentukan glukosa, serta dampaknya pada ekosistem.",
    rubric: "Ketepatan konsep 40%, hubungan sebab-akibat 25%, contoh relevan 20%, kejelasan komunikasi 15%.",
    difficulty: "Menengah",
    examples: "Mengapa cahaya penting dalam proses fotosintesis?",
    count: 5,
    createdAt: new Date().toISOString(),
  };

  return createAssessment(config, generateQuestions(config));
}

export function createSubmission({ assessment, studentName, finalScore, questionScores, feedback }) {
  return {
    id: uid("sub"),
    assessmentId: assessment.id,
    assessmentTitle: assessment.topic,
    studentName,
    submittedAt: new Date().toISOString(),
    finalScore,
    questionScores,
    feedback,
  };
}
