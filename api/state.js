const { getState } = require("../server/database");
const { ensureDatabase } = require("../server/bootstrap");
const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { parseCookies, sendJson } = require("../server/http-utils");
const { applySecurityHeaders } = require("../server/security-headers");

// Shared only within the warm serverless instance, preserving the existing
// notification behavior without allocating another Vercel Function.
const notificationClients = new Set();

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function broadcastNotification(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of notificationClients) {
    try {
      client.res.write(message);
    } catch {
      notificationClients.delete(client);
    }
  }
}

async function handleNotifications(req, res, auth) {
  if (!["admin", "teacher"].includes(auth.user.role)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }

  if (req.method === "GET") {
    applySecurityHeaders(res);
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write("retry: 5000\n\n");

    const client = { res, tenantId: auth.tenant.id };
    notificationClients.add(client);
    req.on("close", () => notificationClients.delete(client));
    return;
  }

  if (req.method === "POST") {
    const body = await readJson(req);
    broadcastNotification(body);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: "Method not allowed" });
}

/**
 * Shared lightweight state/health endpoint.
 * /api/notifications is routed here to keep the project within Vercel
 * Hobby's 12 Serverless Function deployment limit.
 */
module.exports = async (req, res) => {
  const pathname = req.url ? req.url.split("?")[0] : "";

  if (pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "lisan-ai",
      runtime: "vercel",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    await ensureDatabase();
    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

    if (pathname === "/api/notifications") {
      return handleNotifications(req, res, auth);
    }

    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
    return sendJson(res, 200, await getState(auth));
  } catch (error) {
    console.error("State endpoint error:", error);
    if (!res.headersSent) {
      return sendJson(res, error.status || 500, {
        error: error.message || "Gagal memproses state aplikasi",
      });
    }
  }
};
