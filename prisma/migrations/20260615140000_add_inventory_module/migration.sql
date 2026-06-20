-- Inventory module (Borough-only): flower item master, disposal causes, stock-in lots,
-- and disposal records with lot-cost mapping (docs/inventory-stockin-disposal.md).
-- Additive tables. Cross-module references (branchId/channelId/messageId/itemId/sourceLotId)
-- are scalar with NO foreign keys (matches Customer/Reservation/PostTemplate convention; the
-- app degrades safely when the tables are absent, so this is deploy-safe before being applied).
-- Intra-module relations (delivery->line, batch->line) use foreign keys with ON DELETE CASCADE.
-- Money = INTEGER (KRW), quantity = DOUBLE PRECISION (decimal stems/bunches).
-- NOT applied to production — applying requires explicit user approval (see AGENTS.md).

CREATE TABLE "FlowerItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "origin" TEXT,
    "isImported" BOOLEAN NOT NULL DEFAULT false,
    "defaultUnit" TEXT NOT NULL DEFAULT '송이',
    "aliasesJson" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowerItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisposalCause" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisposalCause_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockInDelivery" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "supplier" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sourceText" TEXT NOT NULL DEFAULT '',
    "attachmentsJson" TEXT NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockInDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockInLine" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "lineIndex" INTEGER NOT NULL,
    "lotId" TEXT NOT NULL,
    "itemId" TEXT,
    "itemName" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "stockInDate" TIMESTAMP(3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '송이',
    "unitPrice" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "amount" INTEGER NOT NULL,
    "orderedQty" DOUBLE PRECISION,
    "receiptQty" DOUBLE PRECISION,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "rawText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockInLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisposalBatch" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "disposalDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sourceText" TEXT NOT NULL DEFAULT '',
    "attachmentsJson" TEXT NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisposalBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisposalLine" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "lineIndex" INTEGER NOT NULL,
    "itemId" TEXT,
    "itemName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '송이',
    "category" TEXT NOT NULL,
    "cause" TEXT NOT NULL,
    "sourceLotId" TEXT,
    "unitPrice" INTEGER,
    "amount" INTEGER,
    "note" TEXT,
    "rawText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisposalLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewItemRequest" (
    "id" TEXT NOT NULL,
    "requestedName" TEXT NOT NULL,
    "branchId" TEXT,
    "channelId" TEXT,
    "requestedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedItemId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewItemRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_flower_items_name" ON "FlowerItem"("name");
CREATE INDEX "idx_flower_items_name" ON "FlowerItem"("name");
CREATE INDEX "idx_flower_items_active" ON "FlowerItem"("isActive");

CREATE UNIQUE INDEX "uniq_disposal_causes_name" ON "DisposalCause"("name");

CREATE INDEX "idx_stockin_deliveries_branch_date" ON "StockInDelivery"("branchId", "statementDate");
CREATE INDEX "idx_stockin_deliveries_status" ON "StockInDelivery"("status");

CREATE UNIQUE INDEX "uniq_stockin_lines_lot" ON "StockInLine"("lotId");
CREATE INDEX "idx_stockin_lines_delivery_order" ON "StockInLine"("deliveryId", "lineIndex");
CREATE INDEX "idx_stockin_lines_item_date" ON "StockInLine"("itemName", "stockInDate");

CREATE INDEX "idx_disposal_batches_branch_date" ON "DisposalBatch"("branchId", "disposalDate");
CREATE INDEX "idx_disposal_batches_status" ON "DisposalBatch"("status");

CREATE INDEX "idx_disposal_lines_batch_order" ON "DisposalLine"("batchId", "lineIndex");
CREATE INDEX "idx_disposal_lines_item" ON "DisposalLine"("itemName");
CREATE INDEX "idx_disposal_lines_lot" ON "DisposalLine"("sourceLotId");

CREATE INDEX "idx_new_item_requests_status_created" ON "NewItemRequest"("status", "createdAt");

ALTER TABLE "StockInLine" ADD CONSTRAINT "StockInLine_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "StockInDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisposalLine" ADD CONSTRAINT "DisposalLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DisposalBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
