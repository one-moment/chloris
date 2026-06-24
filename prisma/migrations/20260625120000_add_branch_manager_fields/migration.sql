-- 지점 매니저 관리(Branch Manager Admin): BranchAssignment에 전 지점 플래그 + 감사 필드 추가,
-- branchId nullable화(전 지점 매니저 행은 branchId=null), branchId FK onDelete CASCADE → SET NULL.
-- 감사 필드(assignedById/updatedById)는 disposal-review 관례대로 FK 없는 scalar(loosely coupled).
-- 운영 선적용은 사람 승인 후. 수동 보정: 전부 idempotent(IF NOT EXISTS / DROP+ADD).
ALTER TABLE "BranchAssignment" ADD COLUMN IF NOT EXISTS "isAllBranches" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BranchAssignment" ADD COLUMN IF NOT EXISTS "assignedById" TEXT;
ALTER TABLE "BranchAssignment" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;
-- 기존 행 backfill 위해 DEFAULT CURRENT_TIMESTAMP (Prisma @updatedAt 는 런타임에 값 세팅 → DB default 는 무해).
ALTER TABLE "BranchAssignment" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 전 지점 매니저 행은 특정 지점을 안 가리킴 → branchId nullable. 이미 nullable 이면 no-op.
ALTER TABLE "BranchAssignment" ALTER COLUMN "branchId" DROP NOT NULL;

-- 지점 삭제 시 매니저 배정 행을 보존(특정지점 매니저는 branchId=null 로 떨어짐) — CASCADE → SET NULL.
-- DROP+ADD 쌍은 재실행해도 최종 상태 동일(idempotent).
ALTER TABLE "BranchAssignment" DROP CONSTRAINT IF EXISTS "BranchAssignment_branchId_fkey";
ALTER TABLE "BranchAssignment" ADD CONSTRAINT "BranchAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
