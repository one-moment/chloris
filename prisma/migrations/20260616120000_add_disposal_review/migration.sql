-- 폐기 검수·승인 워크플로우: DisposalBatch에 담당 매니저 태그 + 승인 감사 필드 추가.
-- additive(기존 행은 NULL 허용) — 운영 적용은 사람 승인 후. status는 자유 문자열이라 스키마 변경 없음
-- (draft → review(검수대기) → submitted(승인·시트반영) / rejected(반려)).
ALTER TABLE "DisposalBatch" ADD COLUMN "reviewerId" TEXT;
ALTER TABLE "DisposalBatch" ADD COLUMN "reviewerName" TEXT;
ALTER TABLE "DisposalBatch" ADD COLUMN "reviewRequestedAt" TIMESTAMP(3);
ALTER TABLE "DisposalBatch" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "DisposalBatch" ADD COLUMN "approvedByName" TEXT;
ALTER TABLE "DisposalBatch" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "DisposalBatch" ADD COLUMN "rejectReason" TEXT;
