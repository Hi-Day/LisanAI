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
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
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
}

module.exports = {
  SECURITY_HEADERS,
  applySecurityHeaders,
};