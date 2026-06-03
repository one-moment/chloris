CREATE INDEX IF NOT EXISTS "idx_messages_channel_created"
ON "Message" ("channelId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "idx_posts_channel_created"
ON "Post" ("channelId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "idx_comments_post_created"
ON "Comment" ("postId", "createdAt" ASC);
