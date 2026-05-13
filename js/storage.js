import { DEFAULT_STATE } from "./config.js";
import { loadStateFromDatabase, saveAssessmentToDatabase, saveSubmissionToDatabase } from "./api.js";

const LEGACY_STORAGE_KEY = "oralai-assessment-state";

export async function loadState() {
  try {
    const state = await loadStateFromDatabase();
    if (!state.assessments.length && !state.submissions.length) {
      return await migrateLegacyLocalStorage(state);
    }
    return state;
  } catch (error) {
    alert(`Database belum bisa dimuat. Aplikasi memakai state kosong. Detail: ${error.message}`);
    return structuredClone(DEFAULT_STATE);
  }
}

async function migrateLegacyLocalStorage(currentState) {
  const legacy = readLegacyState();
  if (!legacy.assessments.length && !legacy.submissions.length) return currentState;

  await Promise.all(legacy.assessments.map(saveAssessmentToDatabase));
  await Promise.all(legacy.submissions.map(saveSubmissionToDatabase));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  return legacy;
}

function readLegacyState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    return {
      assessments: Array.isArray(parsed?.assessments) ? parsed.assessments : [],
      submissions: Array.isArray(parsed?.submissions) ? parsed.submissions : [],
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}
