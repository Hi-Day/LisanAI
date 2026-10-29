# LisanAI — BINUS Maya LTI 1.1

This branch adds an LTI 1.1 basic launch endpoint and foundational Basic Outcomes support. Do not enable production use until the BINUS Maya LMS administrator has completed a sandbox launch and grade-passback test.

## Launch URL

- Tool launch URL: https://lisanai.binus.ac.id/api/lti
- HTTP method: POST
- Content type: application/x-www-form-urlencoded
- LTI version: LTI-1p0
- Message type: basic-lti-launch-request
- Signature method: HMAC-SHA1

## Required environment variables

Configure these on the on-premise host using a protected `.env` or institutional secret store. Never commit consumer secrets.

- `LTI_LAUNCH_URL=https://lisanai.binus.ac.id/api/lti`
- `LTI_PUBLIC_ORIGIN=https://lisanai.binus.ac.id`
- `LTI_DEFAULT_REDIRECT_URL=/`
- `LTI_TENANT_ID=<existing LisanAI tenant id for BINUS>`
- `LTI_CONSUMERS_JSON={"<BINUS_MAYA_CONSUMER_KEY>":"<long-random-shared-secret>"}`
- `LTI_OUTCOME_HOSTS=<exact LMS outcome-service hostname(s), comma-separated>`
- `LTI_FRAME_ANCESTORS=<exact HTTPS BINUS Maya origin(s), comma-separated>`

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

## Required BINUS Maya sandbox test matrix

Run these tests against the actual BINUS Maya test configuration, using non-production accounts and a test assessment:

1. Valid student launch and valid instructor launch.
2. Tampered signature, stale timestamp, missing nonce, and duplicate nonce must be rejected.
3. Unknown consumer key and unknown role must fail closed.
4. Existing user with a different tenant or mismatched role must be rejected.
5. Session behavior in iframe and top-level tab, including browsers with third-party cookies disabled.
6. Score passback to the correct gradebook item for a published result, including recovery after a temporary Outcomes Service outage.
7. Unpublished result and human-review-pending result must not pass back.
8. Outcomes Service timeout, non-2xx response, malformed response, and retry/recovery behavior.
9. Verify assessment mapping using signed `custom_lisan_assessment_id` and verify the exact course/resource-link association.

## Remaining integration steps

1. Confirm the exact BINUS Maya LTI 1.1 profile, role strings, launch URL, and whether launch occurs in an iframe or new tab.
2. Confirm how instructors select an LisanAI assessment. A resource-selection flow may still be required.
3. Validate the durable local outbox retry behavior for temporary LMS failures and decide how operations will monitor pending deliveries.
4. Confirm the assessment mapping convention with the LMS administrator.
5. Confirm whether institutional policy permits student answer/transcript content to be sent to OpenRouter for evaluation.

## LTI 1.1 scope

LTI 1.1 is a legacy protocol. It uses OAuth 1.0 signatures and the Basic Outcomes service, which is more limited than LTI 1.3 Assignment and Grade Services. If BINUS Maya supports LTI 1.3, plan a later migration rather than expanding the LTI 1.1 surface.
