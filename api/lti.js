const { ensureDatabase } = require("../server/bootstrap");
const { applySecurityHeaders } = require("../server/security-headers");
const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { parseCookies } = require("../server/http-utils");
const { parseForm, processLaunch, processMapping, processOutcomeOutbox, renderPage, sendHtml } = require("../server/lti");
const crypto = require("node:crypto");

const MAX_BODY_BYTES = 131072;

module.exports = async (req, res) => {
  applySecurityHeaders(res);
  res.setHeader("Cache-Control", "no-store");
  const action = new URL(req.url, "http://localhost").searchParams.get("action");
  try {
    // Vercel Cron retries LMS grade passback that failed earlier (serverless has no background worker).
    if (req.method === "GET" && action === "process-outbox") return await handleOutboxCron(req, res);

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("LTI launch requires POST");
    }
    const contentType = String(req.headers["content-type"] || "").toLowerCase();
    if (!contentType.startsWith("application/x-www-form-urlencoded")) {
      res.writeHead(415, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("LTI launch must use application/x-www-form-urlencoded");
    }
    await ensureDatabase();
    const parameters = parseForm(await readBody(req));

    if (action === "map") {
      const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
      return sendHtml(res, 200, await processMapping(parameters, auth));
    }

    const configuredUrl = process.env.LTI_LAUNCH_URL;
    if (!configuredUrl) throw Object.assign(new Error("LTI_LAUNCH_URL belum dikonfigurasi"), { status: 503 });
    const expected = new URL(configuredUrl);
    const actualPath = new URL(req.url, expected).pathname;
    if (actualPath !== expected.pathname) throw Object.assign(new Error("Endpoint LTI tidak sesuai konfigurasi"), { status: 400 });
    return await processLaunch(parameters, expected.toString(), req, res);
  } catch (error) {
    console.error("[lti] Request rejected:", error.message);
    return sendHtml(res, error.status || 500, renderPage(
      "Integrasi BINUS Maya belum dapat dilanjutkan",
      `<p>${escapeHtml(error.message || "Terjadi kesalahan pada proses LTI.")}</p><p>Jika masalah berlanjut, hubungi administrator LMS atau LisanAI.</p>`,
    ));
  }
};

async function handleOutboxCron(req, res) {
  const secret = process.env.CRON_SECRET || "";
  const provided = String(req.headers.authorization || "");
  const expected = `Bearer ${secret}`;
  const authorized = secret && provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!authorized) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Unauthorized" }));
  }
  await ensureDatabase();
  const result = await processOutcomeOutbox({ limit: 50 });
  res.writeHead(200, { "Content-Type": "application/json" });
  return res.end(JSON.stringify({ processed: result.processed, failed: result.results.filter((item) => !item.ok).length }));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let settled = false;
    req.on("data", (chunk) => {
      if (settled) return;
      body += chunk.toString("utf8");
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        settled = true;
        reject(Object.assign(new Error("Permintaan LTI terlalu besar"), { status: 413 }));
      }
    });
    req.on("end", () => { if (!settled) { settled = true; resolve(body); } });
    req.on("error", (error) => { if (!settled) { settled = true; reject(error); } });
  });
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
