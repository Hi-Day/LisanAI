const fs = require("node:fs");
const path = require("node:path");
const { sendJson } = require("./http-utils");

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
  const filePath = resolveStaticPath(root, pathname);
  if (!filePath) return sendJson(res, 404, { error: "Not found" });

  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function resolveStaticPath(root, pathname) {
  const safePath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const requested = path.normalize(path.join(root, safePath));
  if (!requested.startsWith(root)) return null;
  if (!fs.existsSync(requested) || fs.statSync(requested).isDirectory()) return null;
  return requested;
}

module.exports = {
  serveStaticFile,
};
