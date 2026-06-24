import { uid } from "./utils.js";

export function readAssessmentForm(els) {
  return {
    id: uid("assess"),
    topic: els.topic.value.trim(),
    outcomes: els.outcomes.value.trim(),
    rubric: els.rubric.value.trim(),
    difficulty: els.difficulty.value,
    examples: els.examples.value.trim(),
    classId: els.classSelect.value,
    status: "published",
    count: Number(els.questionCount.value),
    timeLimit: Number(els.timeLimit.value || 0),
    disableManualTyping: els.disableManualTyping.checked,
    allowRetakes: els.allowRetakes.checked,
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
    disableManualTyping: false,
    allowRetakes: false,
    createdAt: new Date().toISOString(),
  };

  return createAssessment(config, generateQuestions(config));
}

export function createSubmission({ assessment, studentName, finalScore, questionScores, feedback }) {
  return {
    id: uid("sub"),
    assessmentId: assessment.id,
    assessmentTitle: assessment.topic,
    classId: assessment.classId,
    studentName,
    submittedAt: new Date().toISOString(),
    finalScore,
    questionScores,
    feedback,
  };
}
