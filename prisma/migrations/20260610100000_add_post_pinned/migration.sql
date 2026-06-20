-- Adds pin support for posts (중요 공지 고정)
ALTER TABLE "Post" ADD COLUMN "pinnedAt" TIMESTAMP(3);
