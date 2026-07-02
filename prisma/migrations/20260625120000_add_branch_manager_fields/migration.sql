-- 지점 매니저 관리(Branch Manager Admin): BranchAssignment에 전 지점 플래그 + 감사 필드 추가,
-- branchId nullable화(전 지점 매니저 행은 branchId=null).
-- v6 정정: branchId FK 는 건드리지 않는다(onDelete CASCADE 유지). SetNull 은 특정지점 삭제 시
--          isAllBranches=false + branchId=null 유령 행을 만들어 상호배타 불변식[B]을 깨므로 비채택.
--          전 지점 행은 branchId=null 이라 FK 와 무관. 변경면 최소 = 컬럼 추가 + DROP NOT NULL 만.
-- 감사 필드(assignedById/updatedById)는 disposal-review 관례대로 FK 없는 scalar(loosely coupled).
-- 운영 선적용은 사람 승인 후. 전부 idempotent(IF NOT EXISTS / DROP NOT NULL 은 재실행 no-op).
ALTER TABLE "BranchAssignment" ADD COLUMN IF NOT EXISTS "isAllBranches" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BranchAssignment" ADD COLUMN IF NOT EXISTS "assignedById" TEXT;
ALTER TABLE "BranchAssignment" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;
-- 기존 행 backfill 위해 DEFAULT CURRENT_TIMESTAMP (Prisma @updatedAt 는 런타임에 값 세팅 → DB default 는 무해).
ALTER TABLE "BranchAssignment" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 전 지점 매니저 행은 특정 지점을 안 가리킴 → branchId nullable. 이미 nullable 이면 no-op.
ALTER TABLE "BranchAssignment" ALTER COLUMN "branchId" DROP NOT NULL;
