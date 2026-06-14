CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliasesJson" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "defaultQuantity" INTEGER NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "maxQuantity" INTEGER NOT NULL,
    "expectedPrice" INTEGER,
    "maxAllowedPrice" INTEGER,
    "defaultDeliveryMemo" TEXT,
    "defaultShippingLocation" TEXT,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "automationLevel" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "expectedPrice" INTEGER,
    "maxAllowedPrice" INTEGER,
    "shippingLocation" TEXT,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "workerTaskId" TEXT,
    "resultScreenshotUrl" TEXT,
    "resultMessage" TEXT,
    "orderNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseWorkerTask" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "automationLevel" TEXT NOT NULL,
    "maxAllowedPrice" INTEGER,
    "status" TEXT NOT NULL,
    "resultMessage" TEXT,
    "screenshotPath" TEXT,
    "observedPrice" INTEGER,
    "errorCode" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseWorkerTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseWorkerTask_purchaseRequestId_key" ON "PurchaseWorkerTask"("purchaseRequestId");
CREATE INDEX "idx_purchase_requests_channel_created" ON "PurchaseRequest"("channelId", "createdAt" DESC);
CREATE INDEX "idx_purchase_requests_status_created" ON "PurchaseRequest"("status", "createdAt");
CREATE INDEX "idx_purchase_worker_tasks_status_created" ON "PurchaseWorkerTask"("status", "createdAt");

ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PurchaseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseWorkerTask" ADD CONSTRAINT "PurchaseWorkerTask_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PurchaseItem" (
  "id", "name", "aliasesJson", "vendor", "url", "defaultQuantity", "unitLabel",
  "minQuantity", "maxQuantity", "expectedPrice", "maxAllowedPrice",
  "defaultShippingLocation", "approvalRequired", "automationLevel", "isActive", "notes", "updatedAt"
) VALUES
(
  'a4-paper',
  'A4용지',
  '["a4","복사용지","A4 용지","A4용지"]',
  'coupang',
  'https://www.coupang.com/',
  2,
  '박스',
  1,
  5,
  38000,
  45000,
  '본사',
  true,
  'add_to_cart',
  true,
  '실제 반복구매 상품 URL로 교체하세요.',
  CURRENT_TIMESTAMP
),
(
  'boro-namecard',
  '보로 강남점 명함',
  '["보로 명함","강남점 명함","명함","보로 강남점 명함"]',
  'swadpia',
  'https://www.swadpia.co.kr/',
  500,
  '매',
  500,
  1000,
  20000,
  30000,
  '보로 강남점',
  true,
  'checkout_ready',
  true,
  '성원애드피아 반복구매 또는 재주문 URL로 교체하세요.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
