# ENV_CHECKLIST.md

## Rules

- Do not write raw environment variable values in this file.
- Do not commit `.env`, `.env.local`, `.env.production`, or downloaded Vercel env files.
- Verify environment variable names and presence only.
- Production secrets must be managed through Vercel/Supabase dashboards or approved CLI workflows.

## Required Local Variables

- `DATABASE_URL`
- `DIRECT_URL`
- `PURCHASE_BOT_WORKER_TOKEN`
- `PURCHASE_BOT_SERVER_URL`

## Required Production Variables

- `DATABASE_URL`
- `DIRECT_URL`
- `PURCHASE_BOT_WORKER_TOKEN`

## Optional/Feature Variables

- `OPENAI_API_KEY`
- `PURCHASE_BOT_APPROVER_USER_IDS`
- `BOT_DEBUG_UNINSTALLED`
- S3-compatible storage variables if file storage is enabled:
  - access key variable
  - secret key variable
  - bucket variable
  - region variable
  - endpoint variable if using non-AWS storage

## Deployment Checklist

- [ ] Confirm user approval for production DB migration.
- [ ] Run local tests.
- [ ] Run `npm run build`.
- [ ] Run `npx prisma migrate status --schema prisma/schema.postgres.prisma`.
- [ ] Run production migration only after approval.
- [ ] Deploy to Vercel production.
- [ ] Verify `/api/health`.
- [ ] Verify DB status.
- [ ] Verify sensitive unauthenticated APIs return safe responses.
- [ ] Check recent Vercel logs.
- [ ] Write deployment log to `#배포로그` Ideas board.

## Worker Checklist

- [ ] Confirm worker target server.
- [ ] Confirm worker token is available locally but not written to docs.
- [ ] Confirm local browser profile/session availability.
- [ ] Confirm no final payment automation is enabled.
- [ ] Confirm debug artifact directory is available.
