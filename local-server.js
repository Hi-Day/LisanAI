const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { PORT, ROOT, loadEnv } = require("./server/config");
const { initDatabase } = require("./server/database");
const { sendJson } = require("./server/http-utils");
const { applySecurityHeaders } = require("./server/security-headers");
const { serveStaticFile } = require("./server/static");

loadEnv();

let isDbInitialized = false;

const requestHandler = async (req, res) => {
  try {
    if (!isDbInitialized) {
      await initDatabase();
      isDbInitialized = true;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Serve the OpenAPI JSON spec document (it is data, not a request handler).
    if (url.pathname === "/api/openapi.json") {
      const specPath = path.join(ROOT, "api", "openapi.json");
      if (!fs.existsSync(specPath)) return sendJson(res, 404, { error: "Spec not found" });
      applySecurityHeaders(res);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return fs.createReadStream(specPath).pipe(res);
    }

    if (url.pathname.startsWith("/api/")) {
      let endpointName = url.pathname.replace("/api/", "");
      // Map /api/v1/... to the v1 handler.
      if (endpointName.startsWith("v1/")) endpointName = "v1";
      // Map /api/docs/... to the docs handler.
      if (endpointName.startsWith("docs/")) endpointName = "docs";
      try {
        const handler = require(`./api/${endpointName}`);
        return await handler(req, res);
      } catch (err) {
        return sendJson(res, 404, { error: "API endpoint not found" });
      }
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
      server.listen(PORT, "127.0.0.1", () => {
        console.log(`Lisan.ai running at http://127.0.0.1:${PORT}`);
        console.log(`Using OpenRouter model: ${process.env.OPENROUTER_MODEL}`);
      });
    })
    .catch((error) => {
      console.error("Gagal menyiapkan database:", error);
      process.exit(1);
    });
}
