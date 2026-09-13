// Vercel deployment boundary for application data operations.
module.exports = async (req, res) => {
  const pathname = req.url ? req.url.split("?")[0] : "";
  if (pathname === "/api/health" || pathname === "/api/notifications") {
    return require("../api-internal/state")(req, res);
  }
  return require("../server/application/data-controller")(req, res);
};
