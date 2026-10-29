# LisanAI — BINUS Maya LTI 1.1

This branch adds an LTI 1.1 basic launch endpoint and foundational Basic Outcomes support. Do not enable production use until the BINUS Maya LMS administrator has completed a sandbox launch and grade-passback test.

## Launch URL

- Tool launch URL: https://lisan-ai-assessment.vercel.app/api/lti
- HTTP method: POST
- Content type: application/x-www-form-urlencoded
- LTI version: LTI-1p0
- Message type: basic-lti-launch-request
- Signature method: HMAC-SHA1

## Required environment variables

Configure these in Vercel for the intended environment. Never commit consumer secrets.

- LTI_LAUNCH_URL=https://lisan-ai-assessment.vercel.app/api/lti
- LTI_PUBLIC_ORIGIN=https://lisan-ai-assessment.vercel.app
- LTI_DEFAULT_REDIRECT_URL=/
- LTI_TENANT_ID=<existing LisanAI tenant id for BINUS>
- LTI_CONSUMERS_JSON={"<BINUS_MAYA_CONSUMER_KEY>":"<long-random-shared-secret>"}
- LTI_OUTCOME_HOSTS=<exact LMS outcome-service hostname(s), comma-separated>
- LTI_FRAME_ANCESTORS=<exact HTTPS BINUS Maya origin(s), comma-separated>

Use a dedicated consumer key and high-entropy secret for the BINUS Maya instance. The Outcomes Service host allowlist must contain only exact HTTPS hostnames supplied by the LMS administrator. Do not use wildcards.

## Implemented protections

- OAuth 1.0 signature validation with HMAC-SHA1.
- Timestamp freshness window (5 minutes).
- Database-backed nonce uniqueness to reject replay across serverless instances.
- Role mapping for Instructor/TeachingAssistant and Learner/Student.
- Tenant-scoped identity mapping; no automatic account linking based only on email.
- Session cookie uses HttpOnly and SameSite=None for LMS iframe launches.
- Outcomes host allowlist and HTTPS-only grade-passback requests.
- Grade passback is triggered only after the official evaluation result is published and does not require human review.
- Frame embedding remains denied by default; it is enabled only for explicitly configured HTTPS origins.
- No-store responses and safe HTML error rendering.

## Remaining integration steps

1. Confirm the exact BINUS Maya LTI 1.1 profile, role strings, launch URL, and whether launch occurs in an iframe or new tab.
2. Confirm how instructors select an LisanAI assessment. The signed custom parameter custom_lisan_assessment_id is recorded for outcome mapping; an instructor-facing resource-selection flow may still be required.
3. Add durable retry/outbox semantics for temporary LMS failures; the current score sync is best-effort and logs failures without retrying.
4. Validate browser behavior with third-party cookies blocked. If the browser blocks third-party cookies, configure the tool to open in a top-level tab or implement an explicit top-level handoff.
5. Run sandbox tests: valid launch, invalid signature, stale timestamp, duplicate nonce, student/instructor role, cross-tenant access, expired session, and grade passback.
6. Confirm the assessment mapping convention: launch links must send the signed custom parameter custom_lisan_assessment_id for score return to the correct LisanAI assessment.

## LTI 1.1 scope

LTI 1.1 is a legacy protocol. It uses OAuth 1.0 signatures and the Basic Outcomes service, which is more limited than LTI 1.3 Assignment and Grade Services. If BINUS Maya supports LTI 1.3, plan a later migration rather than expanding the LTI 1.1 surface.
