const {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSession,
  deleteSession,
  getSessionUser,
  loginUser,
  registerTenantUser,
  createCsrfToken,
} = require("../server/auth-service");
const { initDatabase } = require("../server/database");
const { parseCookies, readJson, sendJson, setCookie } = require("../server/http-utils");
const { assertRateLimit } = require("../server/rate-limit");

let isDbInitialized = false;

module.exports = async (req, res) => {
  try {
    if (!isDbInitialized) {
      await initDatabase();
      isDbInitialized = true;
    }

    if (req.method === "GET") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const action = url.searchParams.get("action");
      if (action === "me") {
        const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
        return sendJson(res, 200, {
          authenticated: Boolean(auth),
          tenant: auth?.tenant || null,
          user: auth?.user || null,
          csrfToken: auth ? createCsrfToken(auth) : null
        });
      }
      if (action === "simulation") {
        if (!isDemoSimulationEnabled()) return sendJson(res, 404, { error: "Action not found" });
        const { getDb } = require("../server/database");
        const db = getDb();
        const tenants = await db.all("SELECT id, name, plan, created_at FROM tenants ORDER BY created_at DESC");
        const users = await db.all("SELECT id, tenant_id, name, email, role, created_at FROM users ORDER BY name ASC");
        return sendJson(res, 200, { tenants, users });
      }
      return sendJson(res, 404, { error: "Action not found" });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const { action, payload } = body;

      if (action === "register") {
        assertRateLimit(rateLimitKey(req, "register"), { limit: 3, windowMs: 10 * 60_000 });
        const auth = await registerTenantUser(payload);
        const session = await createSession(auth.user.id);
        setSessionCookie(res, session.token);
        const authContext = { sessionId: session.sessionId, tenant: auth.tenant, user: auth.user };
        return sendJson(res, 201, { authenticated: true, tenant: auth.tenant, user: auth.user, csrfToken: createCsrfToken(authContext) });
      }

      if (action === "login") {
        assertRateLimit(rateLimitKey(req, `login:${payload?.email || ""}`), { limit: 5, windowMs: 60_000 });
        const auth = await loginUser(payload);
        const session = await createSession(auth.user.id);
        setSessionCookie(res, session.token);
        const authContext = { sessionId: session.sessionId, tenant: auth.tenant, user: auth.user };
        return sendJson(res, 200, { authenticated: true, tenant: auth.tenant, user: auth.user, csrfToken: createCsrfToken(authContext) });
      }

      if (action === "simulate-login") {
        if (!isDemoSimulationEnabled()) return sendJson(res, 404, { error: "Action not found" });
        const { userId } = payload;
        const { getDb } = require("../server/database");
        const db = getDb();
        const userRow = await db.get(
          `SELECT users.*, tenants.name AS tenant_name, tenants.plan AS tenant_plan
           FROM users
           JOIN tenants ON tenants.id = users.tenant_id
           WHERE users.id = ?`,
          userId
        );
        if (!userRow) throw Object.assign(new Error("User tidak ditemukan"), { status: 404 });

        const session = await createSession(userRow.id);
        setSessionCookie(res, session.token);
        const authContext = {
          sessionId: session.sessionId,
          tenant: { id: userRow.tenant_id, name: userRow.tenant_name, plan: userRow.tenant_plan },
          user: { id: userRow.id, tenantId: userRow.tenant_id, name: userRow.name, email: userRow.email, role: userRow.role }
        };
        return sendJson(res, 200, {
          authenticated: true,
          tenant: authContext.tenant,
          user: authContext.user,
          csrfToken: createCsrfToken(authContext)
        });
      }

      if (action === "logout") {
        const token = parseCookies(req)[SESSION_COOKIE];
        const auth = await getSessionUser(token);
        if (auth) {
          const { assertCsrfToken } = require("../server/auth-service");
          try {
            assertCsrfToken(req, auth);
          } catch (csrfError) {
            return sendJson(res, 403, { error: csrfError.message });
          }
          await deleteSession(token);
        }
        setCookie(res, SESSION_COOKIE, "", { maxAge: 0, sameSite: "Lax" });
        return sendJson(res, 200, { ok: true });
      }

      return sendJson(res, 404, { error: "Action not found" });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};

function setSessionCookie(res, token) {
  setCookie(res, SESSION_COOKIE, token, {
    maxAge: SESSION_MAX_AGE_SECONDS,
    sameSite: "Lax",
  });
}

function isDemoSimulationEnabled() {
  return String(process.env.ENABLE_DEMO_SIMULATION || "").toLowerCase() === "true";
}

function rateLimitKey(req, scope) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwardedFor || req.socket?.remoteAddress || "local";
  return `${scope}:${ip}`;
}
