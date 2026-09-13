// Vercel deployment boundary for evaluation, adaptive probing, and evidence feedback.
module.exports = async (req, res) => {
  const pathname = req.url ? req.url.split("?")[0] : "";
  if (pathname === "/api/evidence-feedback") {
    return require("../server/application/evidence-feedback-controller")(req, res);
  }
  return require("../server/application/evaluation-controller")(req, res);
};
