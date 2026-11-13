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
  pairs.sort((a, b) => {
    const left = a[0] === b[0] ? a[1] : a[0];
    const right = a[0] === b[0] ? b[1] : b[0];
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return pairs.map((p) => p[0] + "=" + p[1]).join("&");
}
function normalizedBaseUrl(rawUrl) {
  const u = new URL(rawUrl);
  const port = u.port && !((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) ? ":" + u.port : "";
  return u.protocol.toLowerCase() + "//" + u.hostname.toLowerCase() + port + (u.pathname || "/");
}
function calculateOAuthSignature({ method = "POST", url, parameters, consumerSecret }) {
  const signedParameters = { ...(parameters || {}) };
  const query = new URL(url).searchParams;
  for (const [key, value] of query.entries()) {
    if (Object.prototype.hasOwnProperty.call(signedParameters, key)) {
      signedParameters[key] = Array.isArray(signedParameters[key]) ? signedParameters[key].concat(value) : [signedParameters[key], value];
    } else signedParameters[key] = value;
  }
  const base = [String(method).toUpperCase(), encode(normalizedBaseUrl(url)), encode(normalizeParameters(signedParameters))].join("&");
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
function retryDelayMs(attempts) {
  const exponent = Math.max(0, Math.min(Number(attempts) || 0, 10));
  return Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** exponent));
}

let outboxWorkerPromise = null;
async function processOutcomeOutbox({ limit = 10 } = {}) {
  if (outboxWorkerPromise) return outboxWorkerPromise;
  outboxWorkerPromise = (async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const rows = await db.all(
      "SELECT id, submission_id, consumer_key, tenant_id, user_id, assessment_id, outcome_url, sourced_id, score, attempts FROM lti_outcome_outbox WHERE status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY created_at ASC LIMIT ?",
      now, Math.max(1, Math.min(Number(limit) || 10, 100))
    );
    const results = [];
    for (const row of rows) {
      try {
        const consumers = getConsumers();
        const consumerSecret = consumers[row.consumer_key];
        if (typeof consumerSecret !== "string" || !consumerSecret) throw new Error("Consumer key tidak lagi dikonfigurasi");
        await sendBasicOutcome({
          outcomeUrl: row.outcome_url,
          sourcedId: row.sourced_id,
          score: row.score,
          consumerKey: row.consumer_key,
          consumerSecret,
        });
        const sentAt = new Date().toISOString();
        await db.run(
          "UPDATE lti_outcome_outbox SET status = 'sent', attempts = attempts + 1, last_error = NULL, next_attempt_at = NULL, sent_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
          sentAt, sentAt, row.id
        );
        results.push({ id: row.id, ok: true });
      } catch (error) {
        const attempts = Number(row.attempts || 0) + 1;
        const failedAt = new Date().toISOString();
        const nextAttemptAt = new Date(Date.now() + retryDelayMs(attempts)).toISOString();
        const message = String(error && error.message || "LTI Outcomes delivery failed").slice(0, 500);
        await db.run(
          "UPDATE lti_outcome_outbox SET attempts = ?, last_error = ?, next_attempt_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
          attempts, message, nextAttemptAt, failedAt, row.id
        );
        console.error("[lti] Durable outcome delivery failed; retry scheduled:", message);
        results.push({ id: row.id, ok: false, retryAt: nextAttemptAt });
      }
    }
    return { processed: rows.length, results };
  })().finally(() => { outboxWorkerPromise = null; });
  return outboxWorkerPromise;
}

function startLtiOutcomeWorker({ intervalMs = 15_000 } = {}) {
  const timer = setInterval(() => {
    processOutcomeOutbox().catch((error) => console.error("[lti] Outcome worker error:", error.message));
  }, Math.max(5_000, Number(intervalMs) || 15_000));
  timer.unref?.();
  return timer;
}

/** Durably queue a validated score for LMS passback; returns how many rows were queued. */
async function enqueueOutcomeForSubmission({ tenantId, userId, assessmentId, submissionId, score }) {
  if (!assessmentId || !submissionId || !Number.isFinite(Number(score))) return { queued: 0, reason: "missing-assessment-submission-or-score" };
  const db = getDb();
  // shortcut: one outbox row per (submission, consumer) because of the 024 UNIQUE constraint; the most
  // recently launched resource link wins. Upgrade the constraint if one assessment is linked twice per course.
  const rows = await db.all(
    "SELECT consumer_key, outcome_url, sourced_id FROM lti_outcome_bindings WHERE tenant_id = ? AND user_id = ? AND assessment_id = ? AND sourced_id IS NOT NULL AND outcome_url IS NOT NULL ORDER BY updated_at DESC",
    tenantId, userId, assessmentId
  );
  if (!rows.length) return { queued: 0, reason: "no-lti-outcome-binding" };
  const now = new Date().toISOString();
  const seen = new Set();
  let queued = 0;
  for (const row of rows) {
    if (seen.has(row.consumer_key)) continue;
    seen.add(row.consumer_key);
    if (!outcomeHostAllowed(row.outcome_url)) {
      console.error("[lti] Refusing to queue an outcome for a non-allowlisted host");
      continue;
    }
    const id = crypto.createHash("sha256").update(submissionId + ":" + row.consumer_key).digest("hex");
    // A re-validated (corrected) score replaces the queued value and is delivered again.
    await db.run(
      `INSERT INTO lti_outcome_outbox (id, submission_id, consumer_key, tenant_id, user_id, assessment_id, outcome_url, sourced_id, score, status, attempts, next_attempt_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?)
       ON CONFLICT(submission_id, consumer_key) DO UPDATE SET
         outcome_url = excluded.outcome_url, sourced_id = excluded.sourced_id, score = excluded.score,
         status = 'pending', attempts = 0, next_attempt_at = NULL, last_error = NULL, sent_at = NULL, updated_at = excluded.updated_at
       WHERE lti_outcome_outbox.status = 'pending' OR lti_outcome_outbox.score <> excluded.score`,
      id, submissionId, row.consumer_key, tenantId, userId, assessmentId, row.outcome_url, row.sourced_id, Number(score), now, now
    );
    queued += 1;
  }
  return queued ? { queued } : { queued: 0, reason: "no-valid-outcome-binding" };
}

async function processLaunch(parameters, requestUrl, req, res) {
  const verified = verifyLaunch(parameters, requestUrl);
  const consumerKey = verified.consumerKey;
  if (parameters.lti_message_type !== "basic-lti-launch-request" || parameters.lti_version !== "LTI-1p0") throw Object.assign(new Error("Tipe pesan LTI tidak didukung"), { status: 400 });
  const ltiUserId = String(parameters.user_id || "").trim();
  const contextId = String(parameters.context_id || "").trim();
  const resourceLinkId = String(parameters.resource_link_id || "").trim();
  if (!ltiUserId || !contextId || !resourceLinkId) throw Object.assign(new Error("LTI launch wajib menyertakan user_id, context_id, dan resource_link_id"), { status: 400 });
  const outcomeUrl = String(parameters.lis_outcome_service_url || "").trim();
  const sourcedId = String(parameters.lis_result_sourcedid || "").trim();
  if (Boolean(outcomeUrl) !== Boolean(sourcedId)) {
    throw Object.assign(new Error("LTI Outcomes launch harus menyertakan lis_outcome_service_url dan lis_result_sourcedid bersama-sama"), { status: 400 });
  }
  if (outcomeUrl && !outcomeHostAllowed(outcomeUrl)) {
    throw Object.assign(new Error("Host Outcomes Service belum diizinkan melalui LTI_OUTCOME_HOSTS"), { status: 400 });
  }
  const tenantId = String(process.env.LTI_TENANT_ID || "").trim();
  if (!tenantId) throw Object.assign(new Error("LTI_TENANT_ID belum dikonfigurasi"), { status: 503 });
  const db = getDb();
  try {
    await db.run("INSERT INTO lti_nonces (consumer_key, nonce, oauth_timestamp, created_at) VALUES (?, ?, ?, ?)", consumerKey, verified.nonce, verified.timestamp, new Date().toISOString());
  } catch {
    throw Object.assign(new Error("LTI launch terdeteksi sebagai replay"), { status: 401 });
  }
  const role = roleFromLti(parameters.roles);
  const appUserId = await resolveAppUser(db, { consumerKey, contextId, ltiUserId, tenantId, role, parameters });
  const target = await resolveLaunchTarget(db, { consumerKey, contextId, resourceLinkId, tenantId, parameters });

  if (target && role === "student") {
    await enrollLearner(db, tenantId, target.classId, appUserId);
  }
  if (target && outcomeUrl && sourcedId) {
    await db.run(
      "INSERT INTO lti_outcome_bindings (consumer_key, context_id, resource_link_id, lti_user_id, user_id, tenant_id, assessment_id, outcome_url, sourced_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(consumer_key, context_id, resource_link_id, lti_user_id) DO UPDATE SET user_id=excluded.user_id, tenant_id=excluded.tenant_id, assessment_id=excluded.assessment_id, outcome_url=excluded.outcome_url, sourced_id=excluded.sourced_id, updated_at=excluded.updated_at",
      consumerKey, contextId, resourceLinkId, ltiUserId, appUserId, tenantId, target.assessmentId, outcomeUrl, sourcedId, new Date().toISOString()
    );
  }

  const session = await createSession(appUserId);
  setLaunchSessionCookie(req, res, session.token);

  if (!target) {
    if (role === "teacher") {
      return sendHtml(res, 200, await renderMappingPage(db, {
        consumerKey, contextId, resourceLinkId, tenantId, userId: appUserId,
        resourceTitle: String(parameters.resource_link_title || "").trim().slice(0, 200),
        consumerSecret: verified.consumerSecret,
      }));
    }
    return sendHtml(res, 409, renderPage(
      "Penilaian belum terhubung",
      "<p>Dosen belum menghubungkan materi BINUS Maya ini ke penilaian LisanAI. Coba lagi setelah dosen membuka materi ini sekali dan memilih penilaiannya.</p>"
        + `<p><a class="secondary-button" href="${escapeAttr(appUrl("/"))}">Buka LisanAI</a></p>`,
    ));
  }

  const destination = role === "student"
    ? appUrl(`/?lti_assessment=${encodeURIComponent(target.assessmentId)}#studentView`)
    : appUrl("/#scoreValidationView");
  res.writeHead(303, { Location: destination, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  return res.end();
}

function launchError(message, status) {
  return Object.assign(new Error(message), { status });
}

/**
 * Find or create the LisanAI account for an LTI user. An existing account with the same
 * email is linked when it belongs to the LTI tenant and has the same role (owner decision:
 * the signed BINUS Maya launch is trusted for institutional email). Otherwise a new account
 * is created so the user can start right away.
 */
async function resolveAppUser(db, { consumerKey, contextId, ltiUserId, tenantId, role, parameters }) {
  const identity = await db.get(
    "SELECT u.id, u.tenant_id, u.role FROM lti_identities i JOIN users u ON u.id = i.user_id WHERE i.consumer_key = ? AND i.lti_user_id = ?",
    consumerKey, ltiUserId
  );
  if (identity) {
    if (identity.tenant_id !== tenantId) throw launchError("Identitas LTI terhubung ke tenant berbeda", 403);
    if (identity.role !== role) throw launchError("Role LTI berbeda dari role akun yang sudah ditautkan; minta administrator menyesuaikan role akun", 403);
    return identity.id;
  }

  const lmsEmail = String(parameters.lis_person_contact_email_primary || parameters.lis_person_email_primary || "").trim().toLowerCase();
  const now = new Date().toISOString();
  if (lmsEmail) {
    const existing = await db.get("SELECT id, tenant_id, role FROM users WHERE lower(email) = lower(?)", lmsEmail);
    if (existing) {
      if (existing.tenant_id !== tenantId) throw launchError("Email ini sudah terdaftar di organisasi lain di LisanAI. Hubungi administrator LisanAI.", 409);
      if (existing.role !== role) throw launchError(`Email ini terdaftar sebagai ${existing.role} di LisanAI, tetapi BINUS Maya mengirim role ${role}. Hubungi administrator LisanAI.`, 409);
      const linked = await db.get("SELECT lti_user_id FROM lti_identities WHERE user_id = ?", existing.id);
      if (linked) throw launchError("Akun LisanAI dengan email ini sudah tertaut ke identitas BINUS Maya lain. Hubungi administrator LisanAI.", 409);
      await db.run("INSERT INTO lti_identities (consumer_key, context_id, lti_user_id, user_id, created_at) VALUES (?, ?, ?, ?, ?)", consumerKey, contextId, ltiUserId, existing.id, now);
      return existing.id;
    }
  }

  const email = lmsEmail
    || "lti-" + crypto.createHash("sha256").update(consumerKey + ":" + ltiUserId).digest("hex").slice(0, 24) + "@lti.invalid";
  const name = String(parameters.lis_person_name_full || [parameters.lis_person_name_given, parameters.lis_person_name_family].filter(Boolean).join(" ") || ltiUserId).trim().slice(0, 160);
  const created = await createTenantUser(tenantId, { name, email, password: crypto.randomBytes(32).toString("base64url"), role });
  await db.run("INSERT INTO lti_identities (consumer_key, context_id, lti_user_id, user_id, created_at) VALUES (?, ?, ?, ?, ?)", consumerKey, contextId, ltiUserId, created.id, now);
  return created.id;
}

/** Assessment and class for this resource link: the lecturer's mapping, or a signed custom parameter. */
async function resolveLaunchTarget(db, { consumerKey, contextId, resourceLinkId, tenantId, parameters }) {
  const mapping = await db.get(
    "SELECT assessment_id, class_id FROM lti_resource_links WHERE consumer_key = ? AND context_id = ? AND resource_link_id = ? AND tenant_id = ?",
    consumerKey, contextId, resourceLinkId, tenantId
  );
  if (mapping) return { assessmentId: mapping.assessment_id, classId: mapping.class_id };

  const customId = String(parameters.custom_lisan_assessment_id || "").trim();
  if (!customId) return null;
  const assigned = await db.get(
    "SELECT class_id FROM assessment_classes WHERE tenant_id = ? AND assessment_id = ? ORDER BY assigned_at ASC LIMIT 1",
    tenantId, customId
  );
  if (!assigned) throw launchError("custom_lisan_assessment_id tidak menunjuk penilaian LisanAI yang dibagikan ke kelas", 400);
  return { assessmentId: customId, classId: assigned.class_id };
}

/** LTI learners join the mapped class roster as approved members so they can see and submit. */
async function enrollLearner(db, tenantId, classId, studentId) {
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO class_memberships (id, tenant_id, class_id, student_id, status, requested_at, approved_at)
     VALUES (?, ?, ?, ?, 'approved', ?, ?)
     ON CONFLICT(class_id, student_id) DO UPDATE SET status = 'approved', approved_at = COALESCE(class_memberships.approved_at, excluded.approved_at)`,
    "membership_" + crypto.randomUUID().replace(/-/g, ""), tenantId, classId, studentId, now, now
  );
}

function setLaunchSessionCookie(req, res, token) {
  const { setCookie } = require("./http-utils");
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const secure = proto === "https" || Boolean(req.socket && req.socket.encrypted);
  setCookie(res, "lisan_session", token, { maxAge: 604800, httpOnly: true, sameSite: "None", secure, path: "/" });
}

function appOrigin() {
  return new URL(process.env.LTI_PUBLIC_ORIGIN || "https://lisan-ai-assessment.vercel.app").origin;
}

function appUrl(pathAndQuery) {
  return new URL(pathAndQuery, appOrigin()).toString();
}

// ---- Resource-link mapping (first instructor launch) ----

const MAPPING_TOKEN_TTL_SECONDS = 30 * 60;

function mappingToken({ userId, consumerKey, contextId, resourceLinkId, exp }, consumerSecret) {
  return crypto.createHmac("sha256", consumerSecret)
    .update(["lti-map", userId, consumerKey, contextId, resourceLinkId, exp].join("|"))
    .digest("base64url");
}

async function listMappableTargets(db, tenantId, teacherId) {
  return db.all(
    `SELECT a.id AS assessment_id, a.topic, c.id AS class_id, c.name AS class_name
       FROM assessment_classes ac
       JOIN assessments a ON a.id = ac.assessment_id AND a.tenant_id = ac.tenant_id
       JOIN classes c ON c.id = ac.class_id AND c.tenant_id = ac.tenant_id
      WHERE ac.tenant_id = ? AND c.teacher_id = ?
      ORDER BY a.created_at DESC, c.name ASC`,
    tenantId, teacherId
  );
}

async function renderMappingPage(db, { consumerKey, contextId, resourceLinkId, tenantId, userId, resourceTitle, consumerSecret }) {
  const targets = await listMappableTargets(db, tenantId, userId);
  if (!targets.length) {
    return renderPage(
      "Hubungkan materi ke penilaian",
      "<p>Belum ada penilaian LisanAI yang dibagikan ke kelas Anda. Buat penilaian dan bagikan ke kelas di LisanAI, lalu buka materi BINUS Maya ini lagi.</p>"
        + `<p><a class="primary-button" href="${escapeAttr(appUrl("/#teacherView"))}">Buat penilaian di LisanAI</a></p>`,
    );
  }
  const exp = Math.floor(Date.now() / 1000) + MAPPING_TOKEN_TTL_SECONDS;
  const token = mappingToken({ userId, consumerKey, contextId, resourceLinkId, exp }, consumerSecret);
  const options = targets.map((item, index) => `
      <label class="lti-map-option">
        <input type="radio" name="target" value="${escapeAttr(item.assessment_id + "|" + item.class_id)}" ${index === 0 ? "checked" : ""} required>
        <span><strong>${escapeHtml(item.topic)}</strong><br><small>Kelas: ${escapeHtml(item.class_name)}</small></span>
      </label>`).join("");
  return renderPage(
    "Hubungkan materi ke penilaian",
    `<p>Materi BINUS Maya${resourceTitle ? ` <strong>${escapeHtml(resourceTitle)}</strong>` : " ini"} belum terhubung ke penilaian LisanAI. Pilih penilaian dan kelasnya. Mahasiswa yang membuka materi ini akan otomatis masuk ke kelas tersebut, dan nilai yang sudah Anda validasi dikirim kembali ke BINUS Maya.</p>
    <form method="post" action="${escapeAttr(appUrl("/api/lti?action=map"))}" class="lti-map-form">
      <fieldset><legend>Penilaian LisanAI</legend>${options}</fieldset>
      <input type="hidden" name="consumer_key" value="${escapeAttr(consumerKey)}">
      <input type="hidden" name="context_id" value="${escapeAttr(contextId)}">
      <input type="hidden" name="resource_link_id" value="${escapeAttr(resourceLinkId)}">
      <input type="hidden" name="resource_title" value="${escapeAttr(resourceTitle)}">
      <input type="hidden" name="exp" value="${exp}">
      <input type="hidden" name="token" value="${escapeAttr(token)}">
      <button type="submit" class="primary-button">Hubungkan</button>
    </form>`,
  );
}

/** Save the lecturer's choice. Requires the session from the launch and a token signed for that user and link. */
async function processMapping(form, auth) {
  if (!auth || auth.user.role !== "teacher") throw launchError("Hanya dosen yang dapat menghubungkan materi BINUS Maya", 403);
  const tenantId = String(process.env.LTI_TENANT_ID || "").trim();
  if (!tenantId || auth.tenant.id !== tenantId) throw launchError("Akun ini bukan bagian dari tenant LTI", 403);
  const consumerKey = String(form.consumer_key || "");
  const contextId = String(form.context_id || "");
  const resourceLinkId = String(form.resource_link_id || "");
  const exp = Number(form.exp);
  const consumerSecret = getConsumers()[consumerKey];
  if (typeof consumerSecret !== "string" || !consumerSecret || !contextId || !resourceLinkId) throw launchError("Permintaan pemetaan tidak valid", 400);
  if (!Number.isInteger(exp) || exp < Math.floor(Date.now() / 1000)) throw launchError("Sesi pemetaan kedaluwarsa; buka materi dari BINUS Maya lagi", 401);
  const expected = mappingToken({ userId: auth.user.id, consumerKey, contextId, resourceLinkId, exp }, consumerSecret);
  if (!safeEqual(expected, form.token)) throw launchError("Token pemetaan tidak valid; buka materi dari BINUS Maya lagi", 401);

  const [assessmentId, classId] = String(form.target || "").split("|");
  const db = getDb();
  const allowed = (await listMappableTargets(db, tenantId, auth.user.id))
    .find((item) => item.assessment_id === assessmentId && item.class_id === classId);
  if (!allowed) throw launchError("Penilaian atau kelas tidak ditemukan pada akun Anda", 403);

  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO lti_resource_links (consumer_key, context_id, resource_link_id, tenant_id, assessment_id, class_id, mapped_by, resource_title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(consumer_key, context_id, resource_link_id) DO UPDATE SET
       assessment_id = excluded.assessment_id, class_id = excluded.class_id, mapped_by = excluded.mapped_by,
       resource_title = excluded.resource_title, updated_at = excluded.updated_at`,
    consumerKey, contextId, resourceLinkId, tenantId, assessmentId, classId, auth.user.id,
    String(form.resource_title || "").slice(0, 200) || null, now, now
  );
  return renderPage(
    "Materi terhubung",
    `<p>Materi BINUS Maya ini sekarang terhubung ke <strong>${escapeHtml(allowed.topic)}</strong> (kelas ${escapeHtml(allowed.class_name)}). Mahasiswa dapat membukanya dari BINUS Maya.</p>
     <p><a class="primary-button" href="${escapeAttr(appUrl("/#scoreValidationView"))}">Buka LisanAI</a></p>`,
  );
}

// ---- Minimal server-rendered pages for the LTI flow ----

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const escapeAttr = escapeHtml;

function renderPage(title, bodyHtml) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · LisanAI</title>
<link rel="stylesheet" href="${escapeAttr(appUrl("/styles.css"))}"><link rel="stylesheet" href="${escapeAttr(appUrl("/binus-theme.css"))}">
</head><body><main class="lti-page"><section class="analytics-panel"><h1>${escapeHtml(title)}</h1>${bodyHtml}</section></main></body></html>`;
}

function sendHtml(res, status, html) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
  return res.end(html);
}
module.exports = { CLOCK_SKEW_SECONDS, calculateOAuthSignature, enqueueOutcomeForSubmission, mappingToken, normalizeParameters, normalizedBaseUrl, outcomeHostAllowed, parseForm, processLaunch, processMapping, processOutcomeOutbox, renderPage, sendHtml, retryDelayMs, roleFromLti, sendBasicOutcome, startLtiOutcomeWorker, verifyLaunch };
