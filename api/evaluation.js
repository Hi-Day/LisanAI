// Vercel deployment boundary for evaluation and adaptive probing.
module.exports = async (req, res) => {
  const pathname = req.url ? req.url.split("?")[0] : "";
  if (pathname === "/api/evidence-feedback") {
    return require("../api-internal/evidence-feedback")(req, res);
  }
  return require("../server/application/evaluation-controller")(req, res);
};
