/**
 * Centralized security headers for all HTTP responses.
 * Reusable across the app and future SaaS/API deployments.
 */

// Content-Security-Policy: restrict what the browser may load.
// - 'self' for scripts/styles/images
// - fonts.googleapis.com / fonts.gstatic.com for the Outfit font
// - 'unsafe-inline' for inline styles (needed by the app's dynamic styles)
// - blob: for audio recording (MediaRecorder)
// - data: for inline images/audio
const LTI_FRAME_ANCESTORS = String(process.env.LTI_FRAME_ANCESTORS || "")
  .split(",").map((origin) => origin.trim()).filter(Boolean)
  .filter((origin) => { try { const url = new URL(origin); return url.protocol === "https:" && url.origin === origin; } catch { return false; } });
const FRAME_ANCESTORS_POLICY = LTI_FRAME_ANCESTORS.length ? LTI_FRAME_ANCESTORS.join(" ") : "'none'";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  "connect-src 'self' https://api.openrouter.ai",
  "frame-ancestors " + FRAME_ANCESTORS_POLICY,
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/**
 * Apply security headers to a response object.
 * @param {object} res - Node http.ServerResponse
 */
function applySecurityHeaders(res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
  // X-Frame-Options cannot express an origin allowlist. Keep DENY by default,
  // but omit it only when an explicit HTTPS LTI ancestor allowlist is configured.
  if (LTI_FRAME_ANCESTORS.length) res.removeHeader("X-Frame-Options");
  else res.setHeader("X-Frame-Options", "DENY");
}

module.exports = {
  SECURITY_HEADERS,
  LTI_FRAME_ANCESTORS,
  applySecurityHeaders,
};