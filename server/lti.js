const crypto = require("node:crypto");
const { getDb } = require("./database");
const { createTenantUser, createSession } = require("./auth-service");

const CLOCK_SKEW_SECONDS = 300;

function encode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}
function normalizeParameters(parameters) {
  const pairs = [];
  for (const [key, raw] of Object.entries(parameters || {})) {
    if (key === "oauth_signature") continue;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) pairs.push([encode(key), encode(value)]);
  }
  pairs.sort((a, b) => a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0]));
  return pairs.map((p) => p[0] + "=" + p[1]).join("&");
}
function normalizedBaseUrl(rawUrl) {
  const u = new URL(rawUrl);
  const port = u.port && !((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) ? ":" + u.port : "";
  return u.protocol.toLowerCase() + "//" + u.hostname.toLowerCase() + port + (u.pathname || "/");
}
function calculateOAuthSignature({ method = "POST", url, parameters, consumerSecret }) {
  const base = [String(method).toUpperCase(), encode(normalizedBaseUrl(url)), encode(normalizeParameters(parameters))].join("&");
  return crypto.createHmac("sha1", encode(consumerSecret) + "&").update(base).digest("base64");
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function getConsumers() {
  let consumers;
  try { consumers = JSON.parse(process.env.LTI_CONSUMERS_JSON || "{}"); }
  catch { throw Object.assign(new Error("LTI_CONSUMERS_JSON harus berupa JSON valid"), { status: 500 }); }
  if (!consumers || Array.isArray(consumers) || typeof consumers !== "object") throw Object.assign(new Error("LTI_CONSUMERS_JSON harus berupa object"), { status: 500 });
  return consumers;
}
function verifyLaunch(parameters, requestUrl) {
  const key = String(parameters.oauth_consumer_key || "");
  const secret = getConsumers()[key];
  if (!key || typeof secret !== "string" || !secret) throw Object.assign(new Error("Consumer key LTI tidak dikenal"), { status: 401 });
  if (parameters.oauth_signature_method !== "HMAC-SHA1" || parameters.oauth_version !== "1.0") throw Object.assign(new Error("Metode signature OAuth tidak didukung"), { status: 401 });
  const timestamp = Number(parameters.oauth_timestamp);
  const nonce = String(parameters.oauth_nonce || "");
  if (!Number.isInteger(timestamp) || !nonce || nonce.length > 256) throw Object.assign(new Error("OAuth timestamp/nonce tidak valid"), { status: 401 });
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > CLOCK_SKEW_SECONDS) throw Object.assign(new Error("LTI launch kedaluwarsa; periksa sinkronisasi waktu LMS"), { status: 401 });
  const expected = calculateOAuthSignature({ url: requestUrl, parameters, consumerSecret: secret });
  if (!safeEqual(expected, parameters.oauth_signature)) throw Object.assign(new Error("OAuth signature LTI tidak valid"), { status: 401 });
  return { consumerKey: key, consumerSecret: secret, nonce, timestamp };
}
function parseForm(raw) {
  const out = {};
  for (const [key, value] of new URLSearchParams(raw).entries()) {
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = Array.isArray(out[key]) ? out[key].concat(value) : [out[key], value];
    else out[key] = value;
  }
  return out;
}
function roleFromLti(value) {
  const roles = (Array.isArray(value) ? value : String(value || "").split(",")).map((r) => String(r).trim().toLowerCase());
  if (roles.some((r) => /(^|[/#])instructor$|(^|[/#])teachingassistant$|^teacher$/.test(r))) return "teacher";
  if (roles.some((r) => /(^|[/#])learner$|(^|[/#])student$/.test(r))) return "student";
  throw Object.assign(new Error("Role LTI tidak dikenali; administrator LMS harus mengirim Instructor atau Learner"), { status: 403 });
}
function outcomeHostAllowed(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return false; }
  if (u.protocol !== "https:") return false;
  return String(process.env.LTI_OUTCOME_HOSTS || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean).includes(u.hostname.toLowerCase());
}
function xmlEscape(v) {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function oauthAuthorizationHeader({ url, parameters, consumerSecret }) {
  const oauth = {};
  for (const [key, value] of Object.entries(parameters)) if (key.startsWith("oauth_")) oauth[key] = value;
  oauth.oauth_signature = calculateOAuthSignature({ url, parameters: oauth, consumerSecret });
  return "OAuth " + Object.keys(oauth).sort().map((k) => encode(k) + '="' + encode(oauth[k]) + '"').join(", ");
}
async function sendBasicOutcome({ outcomeUrl, sourcedId, score, consumerKey, consumerSecret }) {
  if (!outcomeHostAllowed(outcomeUrl)) throw new Error("Host Outcomes Service tidak diizinkan; konfigurasi LTI_OUTCOME_HOSTS diperlukan");
  if (!Number.isFinite(Number(score)) || Number(score) < 0 || Number(score) > 100) throw new Error("Skor LTI harus berada pada rentang 0–100");
  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(18).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
  };
  const messageId = crypto.randomUUID();
  const xml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<imsx_POXEnvelopeRequest><imsx_POXHeader><imsx_POXRequestHeaderInfo><imsx_version>V1.0</imsx_version>' +
    '<imsx_messageIdentifier>' + xmlEscape(messageId) + '</imsx_messageIdentifier></imsx_POXRequestHeaderInfo></imsx_POXHeader>' +
    '<imsx_POXBody><replaceResultRequest><resultRecord><sourcedGUID><sourcedId>' + xmlEscape(sourcedId) +
    '</sourcedId></sourcedGUID><result><resultScore><language>en</language><textString>' +
    (Number(score) / 100).toFixed(4) + '</textString></resultScore></result></resultRecord></replaceResultRequest></imsx_POXBody></imsx_POXEnvelopeRequest>';
  const response = await fetch(outcomeUrl, {
    method: "POST",
    headers: { "content-type": "application/xml; charset=utf-8", authorization: oauthAuthorizationHeader({ url: outcomeUrl, parameters: oauth, consumerSecret }) },
    body: xml,
    signal: AbortSignal.timeout(8000),
  });
  const body = (await response.text()).slice(0, 4000);
  if (!response.ok) throw new Error("LTI Outcomes Service gagal dengan HTTP " + response.status);
  if (!/<imsx_codeMajor>success<\/imsx_codeMajor>/i.test(body)) throw new Error("LTI Outcomes Service tidak mengonfirmasi keberhasilan");
  return { ok: true, messageId };
}
async function syncOutcomeForSubmission({ tenantId, userId, assessmentId, score }) {
  if (!assessmentId || !Number.isFinite(Number(score))) return { skipped: true, reason: "missing-assessment-or-score" };
  const rows = await getDb().all(
    "SELECT consumer_key, outcome_url, sourced_id FROM lti_outcome_bindings WHERE tenant_id = ? AND user_id = ? AND assessment_id = ? AND sourced_id IS NOT NULL AND outcome_url IS NOT NULL",
    tenantId, userId, assessmentId
  );
  if (!rows.length) return { skipped: true, reason: "no-lti-outcome-binding" };
  const consumers = getConsumers();
  const results = [];
  for (const row of rows) {
    try {
      if (!consumers[row.consumer_key]) throw new Error("Consumer key tidak lagi dikonfigurasi");
      results.push(await sendBasicOutcome({ outcomeUrl: row.outcome_url, sourcedId: row.sourced_id, score, consumerKey: row.consumer_key, consumerSecret: consumers[row.consumer_key] }));
    } catch (e) {
      console.error("[lti] Outcome sync failed:", e.message);
      results.push({ ok: false, error: e.message });
    }
  }
  return { results };
}
async function processLaunch(parameters, requestUrl, req, res) {
  const verified = verifyLaunch(parameters, requestUrl);
  const consumerKey = verified.consumerKey;
  if (parameters.lti_message_type !== "basic-lti-launch-request" || parameters.lti_version !== "LTI-1p0") throw Object.assign(new Error("Tipe pesan LTI tidak didukung"), { status: 400 });
  const ltiUserId = String(parameters.user_id || "").trim();
  const contextId = String(parameters.context_id || "").trim();
  const resourceLinkId = String(parameters.resource_link_id || "").trim();
  if (!ltiUserId || !contextId || !resourceLinkId) throw Object.assign(new Error("LTI launch wajib menyertakan user_id, context_id, dan resource_link_id"), { status: 400 });
  const tenantId = String(process.env.LTI_TENANT_ID || "").trim();
  if (!tenantId) throw Object.assign(new Error("LTI_TENANT_ID belum dikonfigurasi"), { status: 503 });
  const db = getDb();
  try {
    await db.run("INSERT INTO lti_nonces (consumer_key, nonce, oauth_timestamp, created_at) VALUES (?, ?, ?, ?)", consumerKey, verified.nonce, verified.timestamp, new Date().toISOString());
  } catch {
    throw Object.assign(new Error("LTI launch terdeteksi sebagai replay"), { status: 401 });
  }
  const role = roleFromLti(parameters.roles);
  const identity = await db.get(
    "SELECT u.id, u.tenant_id FROM lti_identities i JOIN users u ON u.id = i.user_id WHERE i.consumer_key = ? AND i.lti_user_id = ?",
    consumerKey, ltiUserId
  );
  let appUserId;
  if (identity) {
    if (identity.tenant_id !== tenantId) throw Object.assign(new Error("Identitas LTI terhubung ke tenant berbeda"), { status: 403 });
    const existingRole = await db.get("SELECT role FROM users WHERE id = ?", identity.id);
    if (!existingRole || existingRole.role !== role) throw Object.assign(new Error("Role LTI berbeda dari role akun yang sudah ditautkan; minta administrator melakukan pemetaan role secara eksplisit"), { status: 403 });
    appUserId = identity.id;
  } else {
    const email = String(parameters.lis_person_contact_email_primary || parameters.lis_person_email_primary || "").trim().toLowerCase()
      || "lti-" + crypto.createHash("sha256").update(consumerKey + ":" + contextId + ":" + ltiUserId).digest("hex").slice(0, 24) + "@lti.invalid";
    if (await db.get("SELECT id FROM users WHERE lower(email) = lower(?)", email)) throw Object.assign(new Error("Email LTI sudah terdaftar. Administrator harus menautkan akun secara eksplisit."), { status: 409 });
    const name = String(parameters.lis_person_name_full || [parameters.lis_person_name_given, parameters.lis_person_name_family].filter(Boolean).join(" ") || ltiUserId).trim().slice(0, 160);
    const created = await createTenantUser(tenantId, { name, email, password: crypto.randomBytes(32).toString("base64url"), role });
    appUserId = created.id;
    await db.run("INSERT INTO lti_identities (consumer_key, context_id, lti_user_id, user_id, created_at) VALUES (?, ?, ?, ?, ?)", consumerKey, contextId, ltiUserId, appUserId, new Date().toISOString());
  }
  const outcomeUrl = String(parameters.lis_outcome_service_url || "").trim();
  const sourcedId = String(parameters.lis_result_sourcedid || "").trim();
  if (outcomeUrl && sourcedId) {
    if (!outcomeHostAllowed(outcomeUrl)) throw Object.assign(new Error("Host Outcomes Service belum diizinkan melalui LTI_OUTCOME_HOSTS"), { status: 400 });
    await db.run(
      "INSERT INTO lti_outcome_bindings (consumer_key, context_id, resource_link_id, lti_user_id, user_id, tenant_id, assessment_id, outcome_url, sourced_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(consumer_key, context_id, resource_link_id, lti_user_id) DO UPDATE SET user_id=excluded.user_id, tenant_id=excluded.tenant_id, assessment_id=excluded.assessment_id, outcome_url=excluded.outcome_url, sourced_id=excluded.sourced_id, updated_at=excluded.updated_at",
      consumerKey, contextId, resourceLinkId, ltiUserId, appUserId, tenantId, String(parameters.custom_lisan_assessment_id || "").trim() || null, outcomeUrl, sourcedId, new Date().toISOString()
    );
  }
  const session = await createSession(appUserId);
  const { setCookie } = require("./http-utils");
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const secure = proto === "https" || Boolean(req.socket && req.socket.encrypted);
  setCookie(res, "lisan_session", session.token, { maxAge: 604800, httpOnly: true, sameSite: "None", secure, path: "/" });
  const origin = process.env.LTI_PUBLIC_ORIGIN || "https://lisan-ai-assessment.vercel.app";
  const destination = new URL(String(process.env.LTI_DEFAULT_REDIRECT_URL || "/"), origin);
  if (destination.origin !== new URL(origin).origin) throw Object.assign(new Error("LTI_DEFAULT_REDIRECT_URL harus same-origin"), { status: 500 });
  res.writeHead(303, { Location: destination.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  return res.end();
}
module.exports = { CLOCK_SKEW_SECONDS, calculateOAuthSignature, normalizeParameters, normalizedBaseUrl, outcomeHostAllowed, parseForm, processLaunch, roleFromLti, sendBasicOutcome, syncOutcomeForSubmission, verifyLaunch };
