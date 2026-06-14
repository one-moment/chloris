CREATE TABLE "AgentApp" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "description" TEXT,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentApp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelAgentInstallation" (
    "id" TEXT NOT NULL,
    "agentAppId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "installedById" TEXT,
    "enabledAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAgentInstallation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentTool" (
    "id" TEXT NOT NULL,
    "agentAppId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "botAppId" TEXT,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agentAppId" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "requesterId" TEXT,
    "status" TEXT NOT NULL,
    "inputText" TEXT NOT NULL,
    "intentJson" TEXT NOT NULL DEFAULT '{}',
    "outputJson" TEXT NOT NULL DEFAULT '{}',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentToolCall" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "agentToolId" TEXT,
    "toolSlug" TEXT NOT NULL,
    "toolType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestJson" TEXT NOT NULL DEFAULT '{}',
    "responseJson" TEXT NOT NULL DEFAULT '{}',
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentToolCall_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT,
    "channelId" TEXT,
    "requesterId" TEXT NOT NULL,
    "approverId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "decisionById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentApp_slug_key" ON "AgentApp"("slug");
CREATE UNIQUE INDEX "uniq_channel_agent_installation" ON "ChannelAgentInstallation"("agentAppId", "channelId");
CREATE INDEX "idx_channel_agent_installations_channel_enabled" ON "ChannelAgentInstallation"("channelId", "enabled");
CREATE UNIQUE INDEX "uniq_agent_tool_slug" ON "AgentTool"("agentAppId", "slug");
CREATE INDEX "idx_agent_tools_bot_app" ON "AgentTool"("botAppId");
CREATE INDEX "idx_agent_runs_agent_created" ON "AgentRun"("agentAppId", "createdAt" DESC);
CREATE INDEX "idx_agent_runs_channel_created" ON "AgentRun"("channelId", "createdAt" DESC);
CREATE INDEX "idx_agent_runs_status_created" ON "AgentRun"("status", "createdAt");
CREATE INDEX "idx_agent_tool_calls_run_created" ON "AgentToolCall"("agentRunId", "createdAt");
CREATE INDEX "idx_agent_tool_calls_tool_created" ON "AgentToolCall"("toolSlug", "createdAt" DESC);
CREATE INDEX "idx_approval_requests_channel_created" ON "ApprovalRequest"("channelId", "createdAt" DESC);
CREATE INDEX "idx_approval_requests_status_created" ON "ApprovalRequest"("status", "createdAt");
CREATE INDEX "idx_approval_requests_entity" ON "ApprovalRequest"("entityType", "entityId");

ALTER TABLE "ChannelAgentInstallation" ADD CONSTRAINT "ChannelAgentInstallation_agentAppId_fkey" FOREIGN KEY ("agentAppId") REFERENCES "AgentApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelAgentInstallation" ADD CONSTRAINT "ChannelAgentInstallation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentTool" ADD CONSTRAINT "AgentTool_agentAppId_fkey" FOREIGN KEY ("agentAppId") REFERENCES "AgentApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentAppId_fkey" FOREIGN KEY ("agentAppId") REFERENCES "AgentApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_agentToolId_fkey" FOREIGN KEY ("agentToolId") REFERENCES "AgentTool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "AgentApp" (
  "id", "slug", "name", "role", "status", "description", "configJson", "updatedAt"
) VALUES (
  'agentapp-purchase-agent',
  'purchase-agent',
  '구매 에이전트',
  'purchase',
  'active',
  '구매 요청을 이해하고 승인 흐름과 공급처 봇/worker 작업을 조율합니다. 결제 자동화는 수행하지 않습니다.',
  '{"mentions":["@구매에이전트","@구매 에이전트"],"requireApproval":true,"paymentAutomationAllowed":false}',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "role" = EXCLUDED."role",
  "status" = EXCLUDED."status",
  "description" = EXCLUDED."description",
  "configJson" = EXCLUDED."configJson",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "AgentTool" (
  "id", "agentAppId", "slug", "name", "type", "status", "botAppId", "configJson", "updatedAt"
) VALUES
(
  'agenttool-purchase-create-request',
  'agentapp-purchase-agent',
  'purchase.create_request',
  '구매요청 생성',
  'internal_service',
  'active',
  'botapp-purchase-bot',
  '{"source":"purchaseBot.handlePurchaseBotCommand"}',
  CURRENT_TIMESTAMP
),
(
  'agenttool-purchase-request-approval',
  'agentapp-purchase-agent',
  'purchase.request_approval',
  '대표이사 승인 요청',
  'approval',
  'active',
  NULL,
  '{"approvalType":"purchase_request"}',
  CURRENT_TIMESTAMP
),
(
  'agenttool-purchase-enqueue-worker',
  'agentapp-purchase-agent',
  'purchase.enqueue_worker_task',
  '구매 worker 작업 등록',
  'local_worker_job',
  'active',
  'botapp-purchase-bot',
  '{"workerTaskModel":"PurchaseWorkerTask","paymentAutomationAllowed":false}',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("agentAppId", "slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "status" = EXCLUDED."status",
  "botAppId" = EXCLUDED."botAppId",
  "configJson" = EXCLUDED."configJson",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ChannelAgentInstallation" (
  "id", "agentAppId", "channelId", "enabled", "configJson", "enabledAt", "updatedAt"
)
SELECT
  'chanagent-purchase-agent-' || "Channel"."id",
  'agentapp-purchase-agent',
  "Channel"."id",
  true,
  '{"allowedTools":["purchase.create_request","purchase.request_approval","purchase.enqueue_worker_task"],"paymentAutomationAllowed":false}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Channel"
WHERE "Channel"."type" = 'purchase'
ON CONFLICT ("agentAppId", "channelId") DO UPDATE SET
  "enabled" = true,
  "enabledAt" = CURRENT_TIMESTAMP,
  "disabledAt" = NULL,
  "configJson" = EXCLUDED."configJson",
  "updatedAt" = CURRENT_TIMESTAMP;
