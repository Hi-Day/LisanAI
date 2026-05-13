const http = require("node:http");
const { PORT, ROOT, loadEnv } = require("./server/config");
const { initDatabase } = require("./server/database");
const { sendJson } = require("./server/http-utils");
const { handleApiRequest } = require("./server/routes");
const { serveStaticFile } = require("./server/static");

loadEnv();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      return await handleApiRequest(req, res, url);
    }

    if (req.method !== "GET") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    return serveStaticFile(res, ROOT, url.pathname);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: error.message || "Server error" });
  }
});

initDatabase()
  .then(() => {
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`OralAI running at http://127.0.0.1:${PORT}`);
      console.log(`Using OpenRouter model: ${process.env.OPENROUTER_MODEL}`);
    });
  })
  .catch((error) => {
    console.error("Gagal menyiapkan database:", error);
    process.exit(1);
  });
