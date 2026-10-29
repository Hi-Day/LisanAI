# LisanAI on-premise deployment

This deployment runs the existing Node.js application and static frontend in Docker, stores the SQLite/libSQL database in a named persistent volume, and exposes the app only on host loopback. Put a campus-managed HTTPS reverse proxy (Nginx, Apache, or an approved ingress) in front of it.

## Requirements

- Linux server supported by Docker Engine and Docker Compose v2.
- A DNS name and valid TLS certificate for the public LisanAI origin.
- Outbound network access to the configured AI provider if using OpenRouter.
- A backup destination with access controls and retention suitable for student records.
- BINUS Maya administrator cooperation to configure the LTI 1.1 tool and sandbox.

The application container does not require a local GPU when evaluation calls OpenRouter. Fully local inference is a separate workstream and requires model-serving capacity plus an adapter/configuration change; setting an API URL alone is not enough.

## First deployment

1. Clone the approved branch and review it before building.
2. Copy \`.env.onprem.example\` to \`.env\`, then replace every placeholder. Never commit \`.env\`.
3. Set \`LTI_PUBLIC_ORIGIN\` and \`LTI_LAUNCH_URL\` to the exact HTTPS domain you will publish.
4. Obtain the existing LisanAI tenant ID assigned to BINUS. Do not use a demo tenant for production.
5. Ask the LMS administrator for the consumer key/shared secret, exact LMS origin, and Outcomes Service hostname. Configure \`LTI_CONSUMERS_JSON\`, \`LTI_FRAME_ANCESTORS\`, and \`LTI_OUTCOME_HOSTS\` with the real values. Keep secrets only in the server's protected \`.env\` or a secret store.
6. Build and start:
   \`\`\`bash
   docker compose build --pull
   docker compose up -d
   docker compose ps
   docker compose logs --tail=200 lisanai
   \`\`\`
7. Verify health from the host:
   \`\`\`bash
   curl --fail http://127.0.0.1:4173/api/healthz
   \`\`\`
   Expected response: \`{"status":"ok","database":"ok"}\`.
8. Configure the campus reverse proxy to forward HTTPS requests to \`http://127.0.0.1:4173\`. Preserve the Host header and set \`X-Forwarded-Proto https\` and \`X-Forwarded-For\`. Ensure the proxy accepts POST requests to \`/api/lti\` and does not strip LTI form fields.
9. Validate the public HTTPS URL and run the LMS sandbox test matrix before production launch.

## Nginx reverse-proxy example

Adapt the domain and TLS paths to campus standards. Do not expose port 4173 directly to the internet.

\`\`\`nginx
server {
    listen 443 ssl;
    server_name lisanai.example.edu;

    ssl_certificate     /etc/letsencrypt/live/lisanai.example.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lisanai.example.edu/privkey.pem;

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
\`\`\`

Configure HTTP-to-HTTPS redirection in the campus-approved manner. TLS termination must happen at a trusted proxy. Keep the application port bound to loopback and restrict server administration to authorized operators.

## Database, backup, and recovery

- The database file lives in the Docker named volume \`lisanai_data\`, mounted at \`/app/data\`.
- Back up the database using a consistent SQLite backup method (for example, SQLite's online backup API or a controlled quiesced copy); do not assume copying a live database file is always consistent.
- Encrypt backups at rest and in transit, restrict access, and test restoration regularly.
- Back up the \`.env\`/secret-store configuration separately and securely. Do not include secrets in tickets, logs, or Git.
- Before upgrading, take a backup, deploy the new image, verify health, run a sandbox assessment, and confirm grade passback.
- Rollback must account for schema migrations: take a backup first and do not roll application code back across an incompatible schema change without a recovery plan.

## LTI 1.1 settings

- Launch URL: \`https://lisanai.example.edu/api/lti\`
- HTTP method: POST
- Content type: \`application/x-www-form-urlencoded\`
- LTI version: \`LTI-1p0\`
- Message type: \`basic-lti-launch-request\`
- Signature: OAuth 1.0 HMAC-SHA1

Configure the exact BINUS Maya origin in \`LTI_FRAME_ANCESTORS\` if the LMS embeds the tool in an iframe. This is an origin, not a page URL. Browser third-party-cookie restrictions may still require opening LisanAI in a top-level tab.

## Go-live acceptance checklist

- [ ] HTTPS certificate valid; HTTP redirects to HTTPS at the proxy.
- [ ] \`/api/healthz\` returns healthy and the container restarts after a controlled failure.
- [ ] A valid LMS launch succeeds; invalid signature, stale timestamp, and replayed nonce are rejected.
- [ ] Student and instructor roles map correctly; unknown roles fail closed.
- [ ] Cross-tenant identity access is rejected.
- [ ] Students can record and submit an assessment without losing audio or answers.
- [ ] Official, published scores reach the correct LMS gradebook item.
- [ ] Human-review-pending and unpublished scores are not sent to the gradebook.
- [ ] LMS/network failure does not destroy a finalized LisanAI submission.
- [ ] Backup restoration and rollback have been rehearsed.
- [ ] Privacy, retention, and incident-response requirements have been approved by the institution.

## Current limitations

- LTI grade passback is best-effort and does not yet have a durable retry/outbox queue.
- Assessment mapping must be confirmed with the LMS administrator and the launch must send the signed \`custom_lisan_assessment_id\` parameter.
- LTI 1.1 is a legacy standard. Prefer LTI 1.3 if BINUS Maya supports it and institutional requirements permit.
- The current evaluation path uses OpenRouter, an external provider. If student data must remain entirely on-premise, local inference and a data-flow review are required before go-live.
