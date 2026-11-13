# LisanAI as an LTI 1.1 Provider for BINUS Maya

LisanAI is an LTI 1.1 (Basic LTI launch + Basic Outcomes) tool provider. BINUS Maya is the consumer.

## 1. Register LisanAI in BINUS Maya

In BINUS Maya: **LTI Provider → Create New**.

| BINUS Maya field | Value |
|---|---|
| Provider Code / Name | e.g. `BINUSLisanAI` |
| Tool URL | `https://lisan-ai-assessment.vercel.app/api/lti` (on-premise: `https://<host>/api/lti`). Not `/lti`. |
| Version | `1.0` |
| Outcome Service | `Yes` (required for grade passback) |
| Is Restricted | as decided by the LMS administrator |
| Consumer Key | a non-secret identifier, e.g. `binusmaya-lisanai` |
| Secret Key | a long random secret, generated locally (below) — never commit or paste it into tickets |
| Is Active | `Yes` |

Generate the secret on your own machine:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## 2. Configure LisanAI (Vercel Production or on-premise `.env`)

| Variable | Value |
|---|---|
| `LTI_LAUNCH_URL` | exactly the Tool URL above |
| `LTI_PUBLIC_ORIGIN` | origin of the Tool URL, e.g. `https://lisan-ai-assessment.vercel.app` |
| `LTI_TENANT_ID` | the LisanAI tenant (organization) that BINUS users belong to |
| `LTI_CONSUMERS_JSON` | `{"<consumer key>":"<secret key>"}` — same pair as in BINUS Maya |
| `LTI_OUTCOME_HOSTS` | exact hostname(s) of BINUS Maya's Outcomes Service (`lis_outcome_service_url`), comma-separated; ask the LMS administrator |
| `LTI_FRAME_ANCESTORS` | exact HTTPS origin(s) of BINUS Maya, only if LisanAI is opened inside an iframe |
| `CRON_SECRET` | random secret; Vercel Cron sends it to retry pending grade passback once a day |

Redeploy after changing environment variables.

## 3. How it works

### Accounts

- Roles: `Instructor`/`TeachingAssistant` → teacher, `Learner`/`Student` → student. Other roles are rejected.
- First launch of a BINUS Maya user:
  - an existing LisanAI account with the same email, in `LTI_TENANT_ID`, with the same role, is linked automatically;
  - an email registered in another tenant, with another role, or already linked to another BINUS Maya identity is refused with an explanation;
  - otherwise a LisanAI account is created automatically (random password; the user always enters through BINUS Maya).
- Later launches use the stored link (`lti_identities`).

### Connecting a BINUS Maya content item to an assessment

BINUS Maya does not send custom launch parameters, so the lecturer connects each content item once:

1. The lecturer opens the content item in BINUS Maya.
2. LisanAI shows **Hubungkan materi ke penilaian** with the lecturer's assessments and classes.
3. The lecturer picks one; the choice is stored in `lti_resource_links` (consumer, course `context_id`, `resource_link_id` → assessment + class).

The form is protected by the launch session and an HMAC token bound to that lecturer and content item (30 minutes). A signed `custom_lisan_assessment_id` is still accepted if a consumer can send it.

Students who open an unconnected item see "Penilaian belum terhubung". After it is connected, a student launch:

- enrolls the student into the connected class as an approved member,
- stores the Outcomes binding (`lis_outcome_service_url`, `lis_result_sourcedid`),
- opens LisanAI directly on that assessment's preparation screen.

### Scores and grade passback

1. When a student finishes, they see feedback (strengths, focus areas, per-question notes) **without any score**.
2. The lecturer opens **Validasi Nilai**, reviews or corrects each AI score ("Tinjau / Koreksi"), then validates one submission or all of an assessment.
3. On validation the score becomes visible to the student, competency data is updated, the approval is recorded for research, and the score is queued in `lti_outcome_outbox` and sent to BINUS Maya (`replaceResult`, score / 100).
4. Failed deliveries stay pending with exponential backoff and are retried on the next validation, by the daily Vercel Cron (`/api/lti?action=process-outbox`), or every 15 s by the on-premise worker.
5. A later correction followed by validation resends the new score; an unchanged score is not resent.

## 4. Protections

- OAuth 1.0 HMAC-SHA1 signature, 5-minute timestamp window, database-backed nonce (replay) check.
- Tenant-scoped identities; role mismatch and cross-tenant email reuse are refused.
- Outcomes host allowlist; HTTPS only; 8 s timeout; success requires `imsx_codeMajor=success`.
- Session cookie `HttpOnly; SameSite=None; Secure` for LMS launches.
- Frame embedding denied unless `LTI_FRAME_ANCESTORS` is set.
- Students never receive unvalidated scores: the server builds their view from a whitelist (`server/score-release.js`).

## 5. Sandbox test before go-live

Use test accounts and a test course in BINUS Maya:

1. Lecturer launch → connect content item → "Materi terhubung".
2. Student launch → lands on the assessment; finishes; sees feedback without a score.
3. Lecturer validates → student sees the score; BINUS Maya gradebook shows score / 100 for the right student and item.
4. Tampered signature, stale timestamp, reused nonce, unknown consumer key → rejected.
5. Lecturer whose email exists in LisanAI → linked to the existing account (no duplicate).
6. Iframe vs. new tab, including a browser that blocks third-party cookies (if blocked, configure BINUS Maya to open the tool in a new tab).
7. Outcomes Service unavailable → score stays pending, delivered later.

## 6. Open questions for the BINUS Maya administrator

- Exact Outcomes Service hostname for `LTI_OUTCOME_HOSTS`.
- Whether the tool opens in an iframe or a new tab (and its origin for `LTI_FRAME_ANCESTORS`).
- Whether launches include the user's email (`lis_person_contact_email_primary`); without it, existing accounts cannot be linked and new accounts get a placeholder email.
- Whether institutional policy permits student answers to be sent to OpenRouter for evaluation.

LTI 1.1 is a legacy protocol. If BINUS Maya later supports LTI 1.3, plan a migration rather than extending the 1.1 surface.
