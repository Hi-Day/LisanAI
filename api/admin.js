// Vercel deployment boundary for administrative, research, and observability APIs.
module.exports = async (req, res) => {
  const pathname = req.url ? req.url.split("?")[0] : "";
  if (pathname === "/api/research") {
    return require("../server/application/research-controller")(req, res);
  }
  if (pathname === "/api/observability") {
    return require("../server/application/observability-controller")(req, res);
  }
  res.statusCode = 404;
  return res.end(JSON.stringify({ error: "Not found" }));
};
