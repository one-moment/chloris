CREATE TABLE "BotApp" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "description" TEXT,
    "webhookUrl" TEXT,
    "signingSecretHash" TEXT,
    "eventSubscriptionsJson" TEXT NOT NULL DEFAULT '[]',
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotApp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BotInstallation" (
    "id" TEXT NOT NULL,
    "botAppId" TEXT NOT NULL,
    "projectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'installed',
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "installedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotInstallation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelBotInstallation" (
    "id" TEXT NOT NULL,
    "botAppId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "installedById" TEXT,
    "enabledAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelBotInstallation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BotCredential" (
    "id" TEXT NOT NULL,
    "botAppId" TEXT NOT NULL,
    "installationId" TEXT,
    "channelBotInstallationId" TEXT,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopesJson" TEXT NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BotEventLog" (
    "id" TEXT NOT NULL,
    "botAppId" TEXT NOT NULL,
    "channelId" TEXT,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestPayloadJson" TEXT NOT NULL DEFAULT '{}',
    "responsePayloadJson" TEXT NOT NULL DEFAULT '{}',
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotEventLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BotApp_slug_key" ON "BotApp"("slug");
CREATE UNIQUE INDEX "BotCredential_tokenHash_key" ON "BotCredential"("tokenHash");
CREATE UNIQUE INDEX "uniq_bot_installation_project" ON "BotInstallation"("botAppId", "projectId");
CREATE UNIQUE INDEX "uniq_channel_bot_installation" ON "ChannelBotInstallation"("botAppId", "channelId");
CREATE INDEX "idx_bot_installations_project" ON "BotInstallation"("projectId");
CREATE INDEX "idx_channel_bot_installations_channel_enabled" ON "ChannelBotInstallation"("channelId", "enabled");
CREATE INDEX "idx_bot_credentials_bot_revoked" ON "BotCredential"("botAppId", "revokedAt");
CREATE INDEX "idx_bot_event_logs_bot_created" ON "BotEventLog"("botAppId", "createdAt" DESC);
CREATE INDEX "idx_bot_event_logs_channel_created" ON "BotEventLog"("channelId", "createdAt" DESC);

ALTER TABLE "BotInstallation" ADD CONSTRAINT "BotInstallation_botAppId_fkey" FOREIGN KEY ("botAppId") REFERENCES "BotApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotInstallation" ADD CONSTRAINT "BotInstallation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelBotInstallation" ADD CONSTRAINT "ChannelBotInstallation_botAppId_fkey" FOREIGN KEY ("botAppId") REFERENCES "BotApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelBotInstallation" ADD CONSTRAINT "ChannelBotInstallation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotCredential" ADD CONSTRAINT "BotCredential_botAppId_fkey" FOREIGN KEY ("botAppId") REFERENCES "BotApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotCredential" ADD CONSTRAINT "BotCredential_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "BotInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotCredential" ADD CONSTRAINT "BotCredential_channelBotInstallationId_fkey" FOREIGN KEY ("channelBotInstallationId") REFERENCES "ChannelBotInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotEventLog" ADD CONSTRAINT "BotEventLog_botAppId_fkey" FOREIGN KEY ("botAppId") REFERENCES "BotApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotEventLog" ADD CONSTRAINT "BotEventLog_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "BotApp" (
  "id", "slug", "name", "type", "status", "description",
  "eventSubscriptionsJson", "configJson", "updatedAt"
) VALUES (
  'botapp-purchase-bot',
  'purchase-bot',
  '구매봇',
  'local_worker',
  'active',
  '반복 구매 요청을 승인 흐름과 로컬 worker 장바구니 준비 작업으로 연결합니다.',
  '["message.created"]',
  '{"allowedVendors":["coupang","swadpia"],"defaultApproverUserIds":[],"maxAutoApprovedAmount":null,"automationLevel":"add_to_cart","requireApproval":true}',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "status" = EXCLUDED."status",
  "description" = EXCLUDED."description",
  "eventSubscriptionsJson" = EXCLUDED."eventSubscriptionsJson",
  "configJson" = EXCLUDED."configJson",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "BotApp" (
  "id", "slug", "name", "type", "status", "description",
  "eventSubscriptionsJson", "configJson", "updatedAt"
) VALUES
(
  'botapp-payroll-bot',
  'payroll-bot',
  '급여명세서봇',
  'internal',
  'active',
  '급여명세서 발송과 확인 요청 자동화를 위한 예정 앱입니다.',
  '["message.created"]',
  '{}',
  CURRENT_TIMESTAMP
),
(
  'botapp-cs-analysis-bot',
  'cs-analysis-bot',
  '상담분석봇',
  'internal',
  'active',
  '상담 로그 요약과 이슈 분류 자동화를 위한 예정 앱입니다.',
  '["message.created"]',
  '{}',
  CURRENT_TIMESTAMP
),
(
  'botapp-inventory-alert-bot',
  'inventory-alert-bot',
  '재고알림봇',
  'internal',
  'active',
  '재고 부족 알림과 보충 요청 자동화를 위한 예정 앱입니다.',
  '["message.created"]',
  '{}',
  CURRENT_TIMESTAMP
),
(
  'botapp-external-webhook-bot',
  'external-webhook-bot',
  '외부 Webhook 봇 추가',
  'external',
  'active',
  '외부 팀이나 파트너가 만든 봇을 Webhook으로 연결하기 위한 skeleton 앱입니다.',
  '["message.created"]',
  '{}',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "status" = EXCLUDED."status",
  "description" = EXCLUDED."description",
  "eventSubscriptionsJson" = EXCLUDED."eventSubscriptionsJson",
  "configJson" = EXCLUDED."configJson",
  "updatedAt" = CURRENT_TIMESTAMP;
