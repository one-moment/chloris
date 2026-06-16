# Deployment Performance Notes

## Regions

- Supabase PostgreSQL project `rodzysyxieneykcuokwh` is hosted through the Seoul pooler endpoint: `aws-1-ap-northeast-2.pooler.supabase.com`.
  - `ap-northeast-2` is AWS Asia Pacific Seoul.
  - Supabase documents that each project is deployed to one primary region, and the shared pooler host uses `aws-[region].pooler.supabase.com`.
- Vercel write API route handlers set `preferredRegion = "icn1"` so message, post, and comment writes run close to the Supabase Seoul region when Vercel honors the route preference.
- `vercel.json` also sets the project-level Function region to `["icn1"]` because production verification on 2026-06-03 showed the route-level preference alone still deployed Node functions in Washington, D.C. (`iad1`).
- Runtime verification:
  - Message/post/comment write routes include `functionRegion`, `vercelEnvironment`, and `preferredRegion` in every `write_api_perf` log line.
  - Write route responses include `x-1moment-function-region` and `x-1moment-request-id`.
  - Vercel's edge/proxy response header `x-vercel-id` should be checked from the client, browser Network panel, or curl output for the same request.
  - A Seoul execution should show `functionRegion: "icn1"` in app logs and an `x-vercel-id` value beginning with `icn1::` or otherwise routing through an Asia region close to Seoul.
  - Before the project-level `regions` setting was added, a production unauthenticated write-route probe returned `x-vercel-id: icn1::iad1::...` and `x-1moment-function-region: iad1`, meaning the user entered through the Seoul edge but the function executed in Washington, D.C.

## Prisma And Pooling

- `DATABASE_URL` should use the Supabase transaction-mode pooler on port `6543` with `pgbouncer=true`.
- `DIRECT_URL` should use the Supabase session-mode pooler on port `5432` and is used by Prisma migrations.
- The app uses a global PrismaClient singleton in `lib/prisma.js` to avoid creating a new client for every module evaluation in warm serverless instances.

## Write Path Goals

- Message/post/comment write routes log `write_api_perf` JSON lines in Vercel logs.
- Logs separate `authMs`, `permissionMs`, `dbInsertMs`, and `totalDurationMs`.
- Write routes return only the inserted row fields needed by the UI and do not perform deep includes or full list refreshes before responding.

## List Query Limits

- `/api/state` limits nested channel messages, posts, comments, and files to 50 rows per collection.
- PostgreSQL indexes support the common list order:
  - `idx_messages_channel_created` on `Message(channelId, createdAt desc)`
  - `idx_posts_channel_created` on `Post(channelId, createdAt desc)`
  - `idx_comments_post_created` on `Comment(postId, createdAt asc)`
