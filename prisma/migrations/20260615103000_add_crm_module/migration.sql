-- CRM module (Borough-only): customers + reservations (Google-sheet successor).
-- Additive tables, no foreign keys (matches PostTemplate convention; the app degrades
-- safely when the tables are absent, so this is deploy-safe before being applied).
-- NOT applied to production — applying requires explicit user approval (see AGENTS.md).
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "homeBranchId" TEXT,
    "memo" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "channelId" TEXT,
    "postId" TEXT,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickupAt" TIMESTAMP(3) NOT NULL,
    "product" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "receiveMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '예약접수',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_customers_phone" ON "Customer"("phone");
CREATE INDEX "idx_customers_name" ON "Customer"("name");
CREATE INDEX "idx_customers_home_branch" ON "Customer"("homeBranchId");
CREATE INDEX "idx_reservations_customer" ON "Reservation"("customerId");
CREATE INDEX "idx_reservations_branch" ON "Reservation"("branchId");
CREATE INDEX "idx_reservations_pickup" ON "Reservation"("pickupAt");
CREATE INDEX "idx_reservations_status" ON "Reservation"("status");
