const { ensureDatabase } = require("../server/bootstrap");
const { applySecurityHeaders } = require("../server/security-headers");
const { parseForm, processLaunch } = require("../server/lti");

module.exports = async (req, res) => {
  applySecurityHeaders(res);
  res.setHeader("Cache-Control", "no-store");
  try {
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
    let body = "";
    await new Promise((resolve, reject) => {
      let settled = false;
      req.on("data", (chunk) => {
        if (settled) return;
        body += chunk.toString("utf8");
        if (Buffer.byteLength(body) > 131072) {
          settled = true;
          reject(Object.assign(new Error("LTI launch terlalu besar"), { status: 413 }));
        }
      });
      req.on("end", () => { if (!settled) { settled = true; resolve(); } });
      req.on("error", (error) => { if (!settled) { settled = true; reject(error); } });
    });
    const parameters = parseForm(body);
    const configuredUrl = process.env.LTI_LAUNCH_URL;
    if (!configuredUrl) throw Object.assign(new Error("LTI_LAUNCH_URL belum dikonfigurasi"), { status: 503 });
    const expected = new URL(configuredUrl);
    const actualPath = new URL(req.url, expected).pathname;
    if (actualPath !== expected.pathname) throw Object.assign(new Error("Endpoint LTI tidak sesuai konfigurasi"), { status: 400 });
    return await processLaunch(parameters, expected.toString(), req, res);
  } catch (error) {
    console.error("[lti] Launch rejected:", error.message);
    const status = error.status || 500;
    res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    return res.end("<!doctype html><html lang=\"id\"><meta charset=\"utf-8\"><title>LisanAI LTI</title><body><main><h1>Integrasi BINUS Maya belum dapat dilanjutkan</h1><p>" +
      escapeHtml(error.message || "Terjadi kesalahan pada proses LTI.") +
      "</p><p>Jika masalah berlanjut, hubungi administrator LMS atau LisanAI.</p></main></body></html>");
  }
};
function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
