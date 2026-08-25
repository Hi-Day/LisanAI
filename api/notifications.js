const { ensureDatabase } = require("../server/bootstrap");
const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { parseCookies, sendJson } = require("../server/http-utils");
const { applySecurityHeaders } = require("../server/security-headers");
const { getDb } = require("../server/database");

/**
 * SSE endpoint for real-time notifications.
 * Teachers receive push events when students submit assessments or complaints.
 *
 * GET /api/notifications — SSE stream
 * POST /api/notifications — push a notification to all connected teachers
 */

const clients = new Set();

module.exports = async (req, res) => {
  try {
    await ensureDatabase();

    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

    if (req.method === "GET") {
      if (!["admin", "teacher"].includes(auth.user.role)) {
        return sendJson(res, 403, { error: "Forbidden" });
      }

      applySecurityHeaders(res);
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.write("retry: 5000\n\n");

      const client = { res, tenantId: auth.tenant.id };
      clients.add(client);

      req.on("close", () => {
        clients.delete(client);
      });
      return;
    }

    if (req.method === "POST") {
      // Internal endpoint (called by evaluation/submission handlers)
      const body = await readJson(req);
      broadcast(body);
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      return sendJson(res, 500, { error: "Server error" });
    }
  }
};

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

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(msg);
    } catch {
      clients.delete(client);
    }
  }
}

module.exports.broadcast = broadcast;