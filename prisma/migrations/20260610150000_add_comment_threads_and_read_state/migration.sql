-- Threaded replies for comments (답글/대댓글)
ALTER TABLE "Comment" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "idx_comments_parent" ON "Comment"("parentId");

-- Per-user channel read tracking (미확인 게시글 수 / 알림)
CREATE TABLE "ChannelReadState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelReadState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_channel_read_state" ON "ChannelReadState"("userId", "channelId");

ALTER TABLE "ChannelReadState" ADD CONSTRAINT "ChannelReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelReadState" ADD CONSTRAINT "ChannelReadState_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
