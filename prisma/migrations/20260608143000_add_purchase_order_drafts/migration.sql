CREATE TABLE "PurchaseOrderDraft" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "requesterName" TEXT,
    "requesterTeam" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sourceText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrderDraftLine" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "lineIndex" INTEGER NOT NULL,
    "vendor" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER,
    "unitLabel" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "rawText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'needs_review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderDraftLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_purchase_order_drafts_channel_created" ON "PurchaseOrderDraft"("channelId", "createdAt" DESC);
CREATE INDEX "idx_purchase_order_drafts_status_created" ON "PurchaseOrderDraft"("status", "createdAt");
CREATE INDEX "idx_purchase_order_draft_lines_draft_order" ON "PurchaseOrderDraftLine"("draftId", "lineIndex");
CREATE INDEX "idx_purchase_order_draft_lines_vendor_status" ON "PurchaseOrderDraftLine"("vendor", "status");

ALTER TABLE "PurchaseOrderDraft" ADD CONSTRAINT "PurchaseOrderDraft_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderDraftLine" ADD CONSTRAINT "PurchaseOrderDraftLine_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "PurchaseOrderDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AgentTool" (
  "id",
  "agentAppId",
  "slug",
  "name",
  "type",
  "status",
  "botAppId",
  "configJson",
  "createdAt",
  "updatedAt"
) VALUES (
  'agenttool-purchase-structure-order',
  'agentapp-purchase-agent',
  'purchase.structure_order_draft',
  '복수 구매요청 구조화',
  'internal_service',
  'active',
  NULL,
  '{"output":"PurchaseOrderDraft"}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT ("agentAppId", "slug") DO UPDATE SET
  "status" = EXCLUDED."status",
  "updatedAt" = CURRENT_TIMESTAMP;
