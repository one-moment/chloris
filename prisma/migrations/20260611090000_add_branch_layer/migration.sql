-- Branch master data + per-branch role assignments (platform-architecture.md 10절)
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");
CREATE UNIQUE INDEX "Branch_slug_key" ON "Branch"("slug");

CREATE TABLE "BranchAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_branch_assignment" ON "BranchAssignment"("userId", "branchId");

ALTER TABLE "BranchAssignment" ADD CONSTRAINT "BranchAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchAssignment" ADD CONSTRAINT "BranchAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Channel" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 초기 지점 마스터 데이터 (2026-06-11 사용자 확정)
INSERT INTO "Branch" ("id", "name", "slug", "status", "createdAt", "updatedAt") VALUES
  ('branch-gangnam-1', '강남1호점', 'gangnam-1', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('branch-gangnam-2', '강남2호점', 'gangnam-2', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('branch-jamsil', '잠실점', 'jamsil', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
