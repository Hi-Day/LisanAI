const { evaluateAnswers, generateQuestions, improveQuestionSet, recommendAssessmentConfig } = require("./assessment-service");
const {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSession,
  createTenantUser,
  deleteTenantUser,
  deleteSession,
  getSessionUser,
  listTenantUsers,
  loginUser,
  registerTenantUser,
  updateTenantUser,
} = require("./auth-service");
const {
  approveMembership,
  clearData,
  createClass,
  deleteAssessment,
  deleteClass,
  deleteMembership,
  getState,
  requestJoinClass,
  saveAssessment,
  saveSubmission,
  updateAssessment,
  updateClass,
  updateMembershipStatus,
} = require("./database");
const { parseCookies, readJson, sendJson, setCookie } = require("./http-utils");

async function handleApiRequest(req, res, url) {
  if (url.pathname.startsWith("/api/auth/")) {
    return handleAuthRequest(req, res, url);
  }

  const auth = await requireAuth(req);
  if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

  if (req.method === "GET" && url.pathname === "/api/state") {
    return sendJson(res, 200, await getState(auth));
  }

  if (req.method === "GET" && url.pathname === "/api/users") {
    requireRole(auth, ["admin"]);
    return sendJson(res, 200, { users: await listTenantUsers(auth.tenant.id) });
  }

  const resource = parseResourcePath(url.pathname);
  if (resource && req.method === "PUT") {
    return handleUpdateRequest(req, res, auth, resource);
  }
  if (resource && req.method === "DELETE") {
    return handleDeleteRequest(res, auth, resource);
  }

  if (req.method === "DELETE" && url.pathname === "/api/data") {
    requireRole(auth, ["admin", "teacher"]);
    await clearData(auth.tenant.id);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (url.pathname === "/api/assessments") {
    requireRole(auth, ["admin", "teacher"]);
    const assessment = await readJson(req);
    await saveAssessment(auth, assessment);
    return sendJson(res, 201, { assessment });
  }

  if (url.pathname === "/api/classes") {
    requireRole(auth, ["admin", "teacher"]);
    const body = await readJson(req);
    const classroom = {
      id: `class-${cryptoRandom()}`,
      name: String(body.name || "").trim(),
      joinCode: cryptoRandom().slice(0, 8).toUpperCase(),
      createdAt: new Date().toISOString(),
    };
    if (!classroom.name) throw Object.assign(new Error("Nama kelas wajib diisi"), { status: 400 });
    await createClass(auth.tenant.id, auth.user.id, classroom);
    return sendJson(res, 201, { class: classroom });
  }

  if (url.pathname === "/api/classes/join") {
    requireRole(auth, ["student"]);
    const body = await readJson(req);
    const classroom = await requestJoinClass(auth.tenant.id, auth.user.id, String(body.joinCode || "").trim().toUpperCase(), {
      id: `member-${cryptoRandom()}`,
      requestedAt: new Date().toISOString(),
    });
    return sendJson(res, 201, { class: classroom });
  }

  if (url.pathname === "/api/classes/approve") {
    requireRole(auth, ["teacher"]);
    const body = await readJson(req);
    await approveMembership(auth.tenant.id, auth.user.id, body.membershipId);
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === "/api/submissions") {
    const submission = await readJson(req);
    const submissionUserId = auth.user.role === "student" ? auth.user.id : null;
    await saveSubmission(auth.tenant.id, submissionUserId, submission);
    return sendJson(res, 201, { submission });
  }

  if (url.pathname === "/api/users") {
    requireRole(auth, ["admin"]);
    const user = await createTenantUser(auth.tenant.id, await readJson(req));
    return sendJson(res, 201, { user });
  }

  if (url.pathname === "/api/generate-questions") {
    requireRole(auth, ["admin", "teacher"]);
    const body = await readJson(req);
    const questions = await generateQuestions(body);
    return sendJson(res, 200, { questions, model: process.env.OPENROUTER_MODEL });
  }

  if (url.pathname === "/api/improve-questions") {
    requireRole(auth, ["admin", "teacher"]);
    const body = await readJson(req);
    const questions = await improveQuestionSet(body);
    return sendJson(res, 200, { questions, model: process.env.OPENROUTER_MODEL });
  }

  if (url.pathname === "/api/recommend-assessment-config") {
    requireRole(auth, ["admin", "teacher"]);
    const body = await readJson(req);
    const recommendation = await recommendAssessmentConfig(body);
    return sendJson(res, 200, { recommendation, model: process.env.OPENROUTER_MODEL });
  }

  if (url.pathname === "/api/evaluate") {
    const body = await readJson(req);
    const evaluation = await evaluateAnswers(body);
    return sendJson(res, 200, { evaluation, model: process.env.OPENROUTER_MODEL });
  }

  return sendJson(res, 404, { error: "Not found" });
}

async function handleUpdateRequest(req, res, auth, resource) {
  const body = await readJson(req);
  if (resource.type === "classes") {
    requireRole(auth, ["admin", "teacher"]);
    return sendJson(res, 200, { class: await updateClass(auth, resource.id, body) });
  }
  if (resource.type === "assessments") {
    requireRole(auth, ["admin", "teacher"]);
    return sendJson(res, 200, { assessment: await updateAssessment(auth, resource.id, body) });
  }
  if (resource.type === "users") {
    requireRole(auth, ["admin"]);
    return sendJson(res, 200, { user: await updateTenantUser(auth.tenant.id, resource.id, body) });
  }
  if (resource.type === "memberships") {
    requireRole(auth, ["teacher"]);
    await updateMembershipStatus(auth, resource.id, body.status);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 404, { error: "Not found" });
}

async function handleDeleteRequest(res, auth, resource) {
  if (resource.type === "classes") {
    requireRole(auth, ["admin", "teacher"]);
    await deleteClass(auth, resource.id);
    return sendJson(res, 200, { ok: true });
  }
  if (resource.type === "assessments") {
    requireRole(auth, ["admin", "teacher"]);
    await deleteAssessment(auth, resource.id);
    return sendJson(res, 200, { ok: true });
  }
  if (resource.type === "users") {
    requireRole(auth, ["admin"]);
    await deleteTenantUser(auth.tenant.id, resource.id, auth.user.id);
    return sendJson(res, 200, { ok: true });
  }
  if (resource.type === "memberships") {
    await deleteMembership(auth, resource.id);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 404, { error: "Not found" });
}

function parseResourcePath(pathname) {
  const match = pathname.match(/^\/api\/(classes|assessments|users|memberships)\/([^/]+)$/);
  return match ? { type: match[1], id: decodeURIComponent(match[2]) } : null;
}

function cryptoRandom() {
  return require("node:crypto").randomUUID().replace(/-/g, "");
}

async function handleAuthRequest(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    const auth = await requireAuth(req);
    return sendJson(res, 200, { authenticated: Boolean(auth), tenant: auth?.tenant || null, user: auth?.user || null });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readJson(req);
    const auth = await registerTenantUser(body);
    const session = await createSession(auth.user.id);
    setSessionCookie(res, session.token);
    return sendJson(res, 201, { authenticated: true, tenant: auth.tenant, user: auth.user });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readJson(req);
    const auth = await loginUser(body);
    const session = await createSession(auth.user.id);
    setSessionCookie(res, session.token);
    return sendJson(res, 200, { authenticated: true, tenant: auth.tenant, user: auth.user });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = parseCookies(req)[SESSION_COOKIE];
    await deleteSession(token);
    setCookie(res, SESSION_COOKIE, "", { maxAge: 0, sameSite: "Lax" });
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: "Not found" });
}

async function requireAuth(req) {
  return getSessionUser(parseCookies(req)[SESSION_COOKIE]);
}

function requireRole(auth, allowedRoles) {
  if (!allowedRoles.includes(auth.user.role)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}

function setSessionCookie(res, token) {
  setCookie(res, SESSION_COOKIE, token, {
    maxAge: SESSION_MAX_AGE_SECONDS,
    sameSite: "Lax",
  });
}

module.exports = {
  handleApiRequest,
};
