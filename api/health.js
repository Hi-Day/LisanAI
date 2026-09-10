const { sendJson } = require("../server/http-utils");

/**
 * Lightweight deployment/runtime probe. Deliberately does not touch the
 * database so it can distinguish Vercel routing/runtime failures from DB or
 * application failures.
 */
module.exports = async (_req, res) => {
  return sendJson(res, 200, {
    ok: true,
    service: "lisan-ai",
    runtime: "vercel",
    timestamp: new Date().toISOString(),
  });
};
