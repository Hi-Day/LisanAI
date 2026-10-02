let installed = false;
let originalFetch = null;

export function installSubmissionFeedback() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const response = await originalFetch(input, init);
    const url = typeof input === "string" ? input : input?.url || "";
    if (!url.endsWith("/api/database") || typeof init?.body !== "string") return response;

    let body;
    try { body = JSON.parse(init.body); } catch { return response; }
    if (body?.action !== "save-submission" || !body?.payload?.id || !response.ok) return response;

    void persistEvidenceFeedback(body.payload).catch((error) => {
      console.warn("[evidence-feedback] enrichment failed", error);
    });
    return response;
  };
}

async function persistEvidenceFeedback(submission) {
  const response = await originalFetch("/api/evidence-feedback", {
    method: "POST",
    credentials: "include",
    headers: await csrfHeaders(),
    body: JSON.stringify({ submission }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

async function csrfHeaders() {
  const response = await originalFetch("/api/auth?action=me", { credentials: "include" });
  const data = response.ok ? await response.json() : {};
  const headers = { "Content-Type": "application/json" };
  if (data.csrfToken) headers["X-CSRF-Token"] = data.csrfToken;
  return headers;
}

if (typeof window !== "undefined") window.setTimeout(installSubmissionFeedback, 0);
