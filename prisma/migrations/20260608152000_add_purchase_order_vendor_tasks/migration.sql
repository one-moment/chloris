CREATE TABLE "PurchaseOrderVendorTask" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "automationLevel" TEXT,
    "lineIdsJson" TEXT NOT NULL DEFAULT '[]',
    "purchaseRequestIdsJson" TEXT NOT NULL DEFAULT '[]',
    "resultMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderVendorTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseOrderVendorTask_draftId_vendor_key" ON "PurchaseOrderVendorTask"("draftId", "vendor");
CREATE INDEX "idx_purchase_order_vendor_tasks_status_created" ON "PurchaseOrderVendorTask"("status", "createdAt");
CREATE INDEX "idx_purchase_order_vendor_tasks_vendor_status" ON "PurchaseOrderVendorTask"("vendor", "status");

ALTER TABLE "PurchaseOrderVendorTask" ADD CONSTRAINT "PurchaseOrderVendorTask_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "PurchaseOrderDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
