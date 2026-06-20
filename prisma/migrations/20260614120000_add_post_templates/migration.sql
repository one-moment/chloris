-- Post templates: reusable free-text post helpers (구매요청/인계사항/공지 등). Core, all brands.
CREATE TABLE "PostTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'personal',
    "channelId" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_post_templates_scope" ON "PostTemplate"("scope");
CREATE INDEX "idx_post_templates_owner" ON "PostTemplate"("ownerId");
CREATE INDEX "idx_post_templates_channel" ON "PostTemplate"("channelId");
