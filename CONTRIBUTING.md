# Contributing to LisanAI

Thank you for considering a contribution.

## Before opening a pull request

1. Open an issue or discussion first for large changes, new features, schema changes, or architectural work.
2. Keep changes focused and explain the problem being solved.
3. Never commit secrets, real API keys, production credentials, student data, or audio recordings. Use `.env.example` for placeholders and keep local environment files untracked.
4. Add or update tests for behavior changes, especially authentication, authorization, tenant isolation, assessment scoring, publication/verification gates, and API behavior.
5. Update documentation when configuration, setup, database migrations, API behavior, or operational procedures change.

## Local setup

Requirements: Node.js 22 and npm.

```bash
npm ci
cp .env.example .env
```

For local development without paid provider calls, configure the documented mock harness mode where appropriate. Use real provider credentials only in your local environment or a secure CI secret store; never paste them into issues or pull requests. Production showcase provisioning requires a unique, strong `SHOWCASE_ADMIN_PASSWORD` environment variable. Do not use a default/shared demo password; configure it in the deployment secret store, not in Git. The live deployment configuration must be verified before enabling showcase provisioning.

Start the application:

```bash
npm run dev
```

## Checks

Run the repository checks before submitting:

```bash
npm run build
npm run check
```

For browser end-to-end tests, install the Playwright Chromium browser as described by Playwright, then run:

```bash
npm run test:e2e
```

The live OpenRouter E2E suite requires a valid `OPENROUTER_API_KEY` and may incur provider costs:

```bash
npm run test:e2e:openrouter
```

Do not claim tests passed unless you ran them and observed a successful result. CI results are the source of truth for the submitted commit.

## Assessment and research integrity

- Preserve evidence-based scoring and the existing verification/publication gates.
- Do not weaken security checks or change expected scores merely to improve benchmark metrics.
- Distinguish synthetic calibration labels from lecturer-validated reference scores.
- Document benchmark dataset provenance, rubric changes, and limitations.
- Avoid including identifiable student answers, recordings, or personal data in fixtures and logs.

## Pull request expectations

- Describe the change, motivation, risks, and verification performed.
- Link related issues and include screenshots only when useful and safe.
- Call out database migrations, environment variables, API changes, and deployment implications.
- Keep pull requests reviewable; do not merge your own changes without the repository's normal review process.
