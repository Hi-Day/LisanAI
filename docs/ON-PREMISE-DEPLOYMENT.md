# LisanAI on-premise deployment

This deployment runs the existing Node.js application and static frontend in Docker, stores the SQLite/libSQL database in a named persistent volume, and exposes the app only on host loopback. Put a campus-managed HTTPS reverse proxy in front of it.

## Target architecture

- Public origin: `https://lisanai.binus.ac.id`
- Application/API: Docker container on the campus server, bound only to `127.0.0.1:4173` on the host.
- Database: local SQLite/libSQL file in the persistent Docker volume `lisanai_data`.
- AI inference: OpenRouter API over outbound HTTPS; the application and primary database remain on-premise. Review the external provider's data-processing terms before sending student answers or transcripts.
- LMS: BINUS Maya LTI 1.1 launch and Basic Outcomes grade passback, enabled only after sandbox validation.

## Requirements

- Linux server supported by Docker Engine and Docker Compose v2.
- DNS record for `lisanai.binus.ac.id` managed by BINUS IT and a valid TLS certificate.
- Campus-approved HTTPS reverse proxy, firewall rules, and outbound access to the configured AI provider.
- A backup destination with access controls and retention suitable for student records.
- BINUS Maya administrator cooperation to configure LTI consumer credentials, exact LMS origin, and Outcomes Service hostname.
- Confirmed existing LisanAI tenant ID for BINUS and a documented data-migration decision.

The application container does not require a local GPU when evaluation calls OpenRouter. Fully local inference is a separate workstream and requires model-serving capacity plus an adapter/configuration change; setting an API URL alone is not enough.

## Pre-deployment gate

1. Confirm DNS resolves to the campus-approved ingress and TLS certificate covers `lisanai.binus.ac.id`.
2. Confirm who owns the Linux host, Docker updates, monitoring, backup, restore, incident response, and student-data retention.
3. Decide whether to start with a clean database or migrate existing production data. **Do not point the new local database at an empty file and assume existing Vercel/Turso data has migrated.** Export/import and validate records, identities, submissions, assessment payloads, and schema before cutover.
4. Obtain the existing BINUS tenant ID. Do not use a demo tenant for production.
5. Obtain LTI consumer key/shared secret, exact BINUS Maya origin, and exact Outcomes Service hostname from the LMS administrator. Never paste the shared secret into chat, tickets, or Git.

## First deployment

1. Clone the reviewed branch and review the diff. Do not deploy a draft PR directly to production.
2. Copy `.env.onprem.example` to `.env`, then replace every placeholder. Keep `.env` owner-readable only (for example, `chmod 600 .env`) and never commit it.
3. Set `LTI_PUBLIC_ORIGIN=https://lisanai.binus.ac.id` and `LTI_LAUNCH_URL=https://lisanai.binus.ac.id/api/lti`.
4. Configure `LTI_TENANT_ID`, `LTI_CONSUMERS_JSON`, `LTI_FRAME_ANCESTORS`, and `LTI_OUTCOME_HOSTS` using exact values confirmed by BINUS Maya administrators.
5. Run the deployment preflight after it is added to the reviewed branch:
   ```bash
   node scripts/onprem-preflight.js
   ```
6. Build and start:
   ```bash
   docker compose build --pull
   docker compose up -d
   docker compose ps
   docker compose logs --tail=200 lisanai
   ```
7. Verify health from the host:
   ```bash
   curl --fail http://127.0.0.1:4173/api/healthz
   ```
   Expected response: `{"status":"ok","database":"ok"}`.
8. Configure the campus reverse proxy to forward HTTPS requests to `http://127.0.0.1:4173`. Preserve the Host header and set `X-Forwarded-Proto https` and `X-Forwarded-For`. Ensure the proxy accepts POST requests to `/api/lti` and does not strip LTI form fields.
9. Configure HTTP-to-HTTPS redirection and TLS policy under campus standards. Do not expose port 4173 directly to the internet.
10. Validate the public HTTPS URL and complete the sandbox test matrix before production launch.

## Nginx reverse-proxy example

Adapt TLS paths and policy to campus standards. The public DNS record and certificate must be provisioned by authorized campus administrators.

```nginx
server {
    listen 443 ssl;
    server_name lisanai.binus.ac.id;

    ssl_certificate     /etc/ssl/certs/lisanai.binus.ac.id.fullchain.pem;
    ssl_certificate_key /etc/ssl/private/lisanai.binus.ac.id.key;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }
}
```

## Container security

Compose binds the service to loopback, runs as the non-root `node` user from the Dockerfile, enables `no-new-privileges`, drops Linux capabilities, limits process count, mounts a small non-executable temporary filesystem, and makes the container root filesystem read-only. The named data volume remains writable for SQLite. Test these controls against the real app before production; do not weaken them without a documented reason.

## Database, backup, and recovery

- Database file: `/app/data/lisan_ai.db` inside volume `lisanai_data`.
- Do not remove the named volume during application upgrades.
- Back up using SQLite's online backup API or a controlled quiesced copy; do not assume copying a live database file is always consistent.
- Encrypt backups at rest and in transit, restrict access, and test restoration regularly.
- Back up the `.env`/secret-store configuration separately and securely. Never include secrets in logs or tickets.
- Before upgrades, take a backup, deploy the new image, verify health, run a sandbox assessment, and confirm grade passback.
- Rollback must account for schema migrations. Do not roll application code back across an incompatible schema change without a recovery plan.
- Define recovery-point and recovery-time objectives with BINUS IT before cutover.

## LTI 1.1 settings

- Launch URL: `https://lisanai.binus.ac.id/api/lti`
- HTTP method: POST
- Content type: `application/x-www-form-urlencoded`
- LTI version: `LTI-1p0`
- Message type: `basic-lti-launch-request`
- Signature: OAuth 1.0 HMAC-SHA1

Configure only the exact BINUS Maya HTTPS origin(s) in `LTI_FRAME_ANCESTORS` if the LMS embeds the tool in an iframe. Browser third-party-cookie restrictions may require opening LisanAI in a top-level tab. Do not guess the Outcomes Service hostname or assessment mapping convention.

## Go-live acceptance checklist

- [ ] DNS and valid HTTPS certificate for `lisanai.binus.ac.id`; HTTP redirects to HTTPS.
- [ ] App port 4173 is not publicly reachable.
- [ ] `/api/healthz` returns healthy and the container restarts after a controlled failure.
- [ ] Container runs non-root with configured hardening and the data volume persists across recreation.
- [ ] Backup restoration and rollback have been rehearsed.
- [ ] Valid LMS launch succeeds; invalid signature, stale timestamp, and replayed nonce are rejected.
- [ ] Student and instructor roles map correctly; unknown roles fail closed.
- [ ] Cross-tenant identity access is rejected.
- [ ] Browser behavior is tested with third-party cookies blocked and iframe/top-level launch agreed.
- [ ] Students can record and submit an assessment without losing audio or answers.
- [ ] Official, published scores reach the correct LMS gradebook item.
- [ ] Human-review-pending and unpublished scores are not sent to the gradebook.
- [ ] LMS/network failure does not destroy a finalized LisanAI submission and score sync recovery behavior is documented.
- [ ] Privacy, external AI data flow, retention, and incident-response requirements are approved by the institution.

## Current limitations / explicit blockers

- LTI grade passback currently uses best-effort delivery; a durable retry/outbox mechanism is not yet implemented. Treat grade passback as **not production-ready** until that is addressed or an operationally accepted alternative is tested.
- Assessment mapping must be confirmed with the LMS administrator; the launch must send the signed `custom_lisan_assessment_id` parameter.
- LTI 1.1 is a legacy standard. Prefer LTI 1.3 if BINUS Maya supports it and institutional requirements permit.
- The current evaluation path uses OpenRouter, an external provider. Review what student content is sent and the provider's terms with the institution before go-live.
- No campus server deployment or BINUS Maya sandbox test has been performed by this repository change. Do not mark production-ready based on CI alone.
