# Deployment Performance Notes

## Regions

- Supabase PostgreSQL project `rodzysyxieneykcuokwh` is hosted through the Seoul pooler endpoint: `aws-1-ap-northeast-2.pooler.supabase.com`.
- Vercel write API route handlers set `preferredRegion = "icn1"` so message, post, and comment writes run close to the Supabase Seoul region when Vercel honors the route preference.

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
