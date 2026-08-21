const fs = require("node:fs");
const path = require("node:path");
const { sendJson } = require("../server/http-utils");

const SPEC_PATH = path.join(__dirname, "openapi.json");

/**
 * API documentation endpoints.
 *   GET /api/docs/spec  -> OpenAPI JSON spec
 *   GET /api/docs       -> Swagger UI HTML
 */
module.exports = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname.replace(/^\/api\/docs/, "");

  // Serve the OpenAPI JSON spec.
  if (req.method === "GET" && (pathname === "/spec" || pathname === "/spec.json")) {
    const spec = JSON.parse(fs.readFileSync(SPEC_PATH, "utf8"));
    return sendJson(res, 200, spec);
  }

  // Serve the Swagger UI HTML.
  if (req.method === "GET" && (pathname === "" || pathname === "/")) {
    const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lisan.ai API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: "/api/docs/spec",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: "BaseLayout",
      });
    };
  </script>
</body>
</html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(html);
  }

  return sendJson(res, 404, { error: "Not found" });
};