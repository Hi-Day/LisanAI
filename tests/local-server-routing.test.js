const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const dbPath = path.join(os.tmpdir(), `oralai-local-routing-${Date.now()}.db`);
process.env.TURSO_DATABASE_URL = `file:${dbPath}`;

const requestHandler = require("../local-server");

function call(method, url) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {},
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      getHeader(name) { return this.headers[name.toLowerCase()]; },
      removeHeader(name) { delete this.headers[name.toLowerCase()]; },
      writeHead(status, headers = {}) { this.statusCode = status; Object.assign(this.headers, headers); return this; },
      end(body = "") { resolve({ status: this.statusCode, body: String(body) }); },
    };
    const req = { method, url, headers: { host: "localhost" }, socket: {}, on() {} };
    requestHandler(req, res);
  });
}

test.after(() => {
  try { fs.rmSync(dbPath, { force: true }); } catch {} // Windows keeps the open libsql file locked (EBUSY)
});

test("on-premise/local server uses the vercel.json aliases (e.g. /api/database -> api/data.js)", async () => {
  const aliased = await call("GET", "/api/database?action=state");
  assert.notEqual(aliased.status, 404, "an aliased endpoint must reach its handler");
  const unknown = await call("GET", "/api/does-not-exist");
  assert.equal(unknown.status, 404);
  const traversal = await call("GET", "/api/..%2Fserver%2Fconfig");
  assert.equal(traversal.status, 404);
});
