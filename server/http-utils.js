const { applySecurityHeaders } = require("./security-headers");

const MAX_BODY_CHARS = Number(process.env.MAX_REQUEST_BODY_CHARS) || 4_000_000;

function payloadTooLarge() {
  return Object.assign(new Error("Payload terlalu besar"), { status: 413 });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let settled = false;
    const rejectTooLarge = () => {
      if (settled) return;
      settled = true;
      reject(payloadTooLarge());
    };

    // Reject early when the declared size already exceeds the limit. This avoids
    // reading a huge body only to reject it after the fact.
    if (Number((req.headers && req.headers["content-length"]) || 0) > MAX_BODY_CHARS) {
      rejectTooLarge();
      return;
    }

    req.on("data", (chunk) => {
      if (settled) return;
      raw += chunk;
      if (raw.length > MAX_BODY_CHARS) rejectTooLarge();
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("JSON tidak valid"));
      }
    });
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

function sendJson(res, status, data) {
  applySecurityHeaders(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  parts.push(`Path=${options.path || "/"}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

module.exports = {
  parseCookies,
  readJson,
  sendJson,
  setCookie,
};
