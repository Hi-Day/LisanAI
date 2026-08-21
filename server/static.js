const fs = require("node:fs");
const path = require("node:path");
const { sendJson } = require("./http-utils");
const { applySecurityHeaders } = require("./security-headers");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function serveStaticFile(res, root, pathname) {
  const publicDir = path.join(root, "public");
  const filePath = resolveStaticPath(publicDir, pathname);
  if (!filePath) return sendJson(res, 404, { error: "Not found" });

  const ext = path.extname(filePath);
  applySecurityHeaders(res);
  res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function resolveStaticPath(root, pathname) {
  const safePath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  let requested = path.normalize(path.join(root, safePath));
  if (!requested.startsWith(root)) return null;

  // Clean URL support: if file doesn't exist and has no extension, try appending .html
  if (!fs.existsSync(requested) && !path.extname(requested)) {
    const htmlPath = requested + ".html";
    if (fs.existsSync(htmlPath)) {
      requested = htmlPath;
    }
  }

  if (!fs.existsSync(requested) || fs.statSync(requested).isDirectory()) return null;
  return requested;
}

module.exports = {
  serveStaticFile,
};
