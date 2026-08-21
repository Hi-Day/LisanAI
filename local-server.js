const http = require("node:http");
const { PORT, ROOT, loadEnv } = require("./server/config");
const { initDatabase } = require("./server/database");
const { sendJson } = require("./server/http-utils");
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

    if (url.pathname.startsWith("/api/")) {
      let endpointName = url.pathname.replace("/api/", "");
      // Map /api/v1/... to the v1 handler.
      if (endpointName.startsWith("v1/")) endpointName = "v1";
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
