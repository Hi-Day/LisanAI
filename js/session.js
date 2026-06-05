export function createSession(state) {
  return {
    currentAssessmentId: null,
    currentQuestionIndex: 0,
    currentAnswers: [],

    getCurrentAssessment() {
      return state.assessments.find((assessment) => assessment.id === this.currentAssessmentId);
    },

    ensureAssessmentSelected() {
      if (!state.assessments.length) {
        this.currentAssessmentId = null;
        this.currentAnswers = [];
        this.currentQuestionIndex = 0;
        return;
      }

      const existing = state.assessments.some((assessment) => assessment.id === this.currentAssessmentId);
      if (!existing) this.selectAssessment(state.assessments[0].id);
    },

    selectAssessment(assessmentId) {
      const assessment = state.assessments.find((item) => item.id === assessmentId);
      this.currentAssessmentId = assessmentId;
      // Initialize with object containing text and audio
      this.currentAnswers = Array(assessment?.questions.length || 0).fill(null).map(() => ({ text: "", audio: null }));
      this.currentQuestionIndex = 0;
    },

    saveAnswer(answer, audioBase64 = null) {
      if (!this.currentAnswers[this.currentQuestionIndex]) {
        this.currentAnswers[this.currentQuestionIndex] = { text: "", audio: null };
      }
      this.currentAnswers[this.currentQuestionIndex].text = (answer || "").trim();
      if (audioBase64) {
        this.currentAnswers[this.currentQuestionIndex].audio = audioBase64;
      }
    },

    goPrevious() {
      this.currentQuestionIndex = Math.max(0, this.currentQuestionIndex - 1);
    },

    goNext() {
      const assessment = this.getCurrentAssessment();
      if (!assessment) return;
      this.currentQuestionIndex = Math.min(assessment.questions.length - 1, this.currentQuestionIndex + 1);
    },
  };
}
