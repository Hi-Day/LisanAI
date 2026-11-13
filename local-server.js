const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { PORT, ROOT, loadEnv } = require("./server/config");
const { initDatabase } = require("./server/database");
const { sendJson } = require("./server/http-utils");
const { applySecurityHeaders } = require("./server/security-headers");
const { serveStaticFile } = require("./server/static");
const pricing = require("./server/ai/pricing");
const { startLtiOutcomeWorker } = require("./server/lti");

loadEnv();

// Warm the live OpenRouter price catalog so observability cost estimates use
// real per-token prices instead of fallback defaults. Non-blocking: a slow or
// failed catalog refresh must not delay requests.
pricing.refreshCatalog().catch(() => {});

let isDbInitialized = false;

// Same /api routing as production (vercel.json), e.g. /api/database -> api/data.js.
const API_ROUTES = (JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8")).routes || [])
  .filter((route) => String(route.src).startsWith("/api/") && /^\/api\/[^/]+\.js$|^\/api\/\$1\.js$/.test(String(route.dest)))
  .map((route) => ({ pattern: new RegExp(`^${route.src}$`), dest: route.dest }));

function resolveApiEndpoint(pathname) {
  for (const route of API_ROUTES) {
    const match = pathname.match(route.pattern);
    if (!match) continue;
    const name = route.dest.replace("$1", match[1] || "").replace(/^\/api\//, "").replace(/\.js$/, "");
    return /^[a-z0-9-]+$/i.test(name) ? name : null;
  }
  return null;
}

const requestHandler = async (req, res) => {
  try {
    if (!isDbInitialized) {
      await initDatabase();
      isDbInitialized = true;
    }
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/healthz") {
      const { applySecurityHeaders } = require("./server/security-headers");
      applySecurityHeaders(res);
      res.setHeader("Cache-Control", "no-store");
      try {
        await require("./server/database").getDb().get("SELECT 1 AS ok");
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ status: "ok", database: "ok" }));
      } catch (error) {
        console.error("[healthz] Database check failed:", error.message);
        res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ status: "degraded", database: "error" }));
      }
    }

    // Serve the OpenAPI JSON spec document (it is data, not a request handler).
    if (url.pathname === "/api/openapi.json") {
      const specPath = path.join(ROOT, "api", "openapi.json");
      if (!fs.existsSync(specPath)) return sendJson(res, 404, { error: "Spec not found" });
      applySecurityHeaders(res);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return fs.createReadStream(specPath).pipe(res);
    }

    if (url.pathname.startsWith("/api/")) {
      const endpointName = resolveApiEndpoint(url.pathname);
      let handler;
      try {
        handler = endpointName && require(`./api/${endpointName}`);
      } catch (err) {
        if (err.code !== "MODULE_NOT_FOUND") throw err;
      }
      if (typeof handler !== "function") return sendJson(res, 404, { error: "API endpoint not found" });
      return await handler(req, res);
    }

    if (req.method !== "GET") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    return serveStaticFile(res, ROOT, url.pathname);
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};

module.exports = requestHandler;

if (require.main === module) {
  const server = http.createServer(requestHandler);
  initDatabase()
    .then(() => {
      isDbInitialized = true;
      startLtiOutcomeWorker();
      const { purgeExpiredRows } = require("./server/maintenance");
      setInterval(() => purgeExpiredRows().catch((error) => console.error("[maintenance] purge failed:", error.message)), 60 * 60 * 1000).unref();
      server.listen(PORT, process.env.HOST || "127.0.0.1", () => {
        console.log(`Lisan.ai running at http://127.0.0.1:${PORT}`);
        console.log(`Using OpenRouter model: ${process.env.OPENROUTER_MODEL}`);
      });
    })
    .catch((error) => {
      console.error("Gagal menyiapkan database:", error);
      process.exit(1);
    });
}
