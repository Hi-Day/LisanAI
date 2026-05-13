export function getElements() {
  return {
    navButtons: document.querySelectorAll(".nav-button"),
    views: document.querySelectorAll(".view"),
    form: document.querySelector("#assessmentForm"),
    assessmentList: document.querySelector("#assessmentList"),
    assessmentCount: document.querySelector("#assessmentCount"),
    studentSelect: document.querySelector("#studentAssessmentSelect"),
    studentEmpty: document.querySelector("#studentEmpty"),
    studentWorkspace: document.querySelector("#studentWorkspace"),
    questionProgress: document.querySelector("#questionProgress"),
    activeDifficulty: document.querySelector("#activeDifficulty"),
    activeQuestion: document.querySelector("#activeQuestion"),
    activeHint: document.querySelector("#activeHint"),
    recordButton: document.querySelector("#recordButton"),
    recordStatus: document.querySelector("#recordStatus"),
    answerText: document.querySelector("#answerText"),
    prevQuestion: document.querySelector("#prevQuestion"),
    saveAnswer: document.querySelector("#saveAnswer"),
    answerMap: document.querySelector("#answerMap"),
    studentName: document.querySelector("#studentName"),
    finishAssessment: document.querySelector("#finishAssessment"),
    resultPanel: document.querySelector("#resultPanel"),
    submissionCount: document.querySelector("#submissionCount"),
    submissionList: document.querySelector("#submissionList"),
    classAverage: document.querySelector("#classAverage"),
    trendList: document.querySelector("#trendList"),
    seedDemo: document.querySelector("#seedDemo"),
    resetData: document.querySelector("#resetData"),
    topic: document.querySelector("#topic"),
    outcomes: document.querySelector("#outcomes"),
    rubric: document.querySelector("#rubric"),
    difficulty: document.querySelector("#difficulty"),
    examples: document.querySelector("#examples"),
    questionCount: document.querySelector("#questionCount"),
  };
}

export function setButtonLoading(button, loading, loadingText, defaultText) {
  button.disabled = loading;
  button.textContent = loading ? loadingText : defaultText;
}

export function showEmpty(container, className, message) {
  container.className = className;
  container.textContent = message;
}
