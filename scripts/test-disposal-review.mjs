// 폐기 검수·승인 워크플로우 통합 흐름 테스트 (로컬 sqlite, 1회 실행 — 무인 루프 금지).
// 실행: npx tsx scripts/test-disposal-review.mjs   (사전: db push로 dev.db 동기화)
// 실제 병합된 헬퍼를 호출해 검증한다: 상태머신·권한(canApproveDisposal)·검증 게이트·
// 자동 채널 게시글(postDisposalReviewRequest, 재요청 시 갱신)·승인/반려 DB 전이·경쟁 가드.
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma.js";
import { canTransitionDisposal, normalizeAuthorStatus, formatDisposalPostBody } from "../lib/inventory.js";
import {
  canApproveDisposal,
  branchManagers,
  validateDisposalForSubmit,
  postDisposalReviewRequest,
  postDisposalDecision,
  buildDisposalLineData
} from "../lib/inventoryServer.js";

const P = "tdr"; // 테스트 행 prefix(정리용)
const projectId = `${P}-project`, branchId = `${P}-branch`, channelId = `${P}-channel`;
const authorId = `${P}-author`, managerId = `${P}-manager`, outsiderId = `${P}-outsider`, adminId = `${P}-admin`;

let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`  ✓ ${name}`); }

async function cleanup() {
  await prisma.disposalBatch.deleteMany({ where: { id: { startsWith: `${P}-` } } }); // lines cascade
  await prisma.message.deleteMany({ where: { channelId } });
  await prisma.branchAssignment.deleteMany({ where: { branchId } });
  await prisma.channel.deleteMany({ where: { id: channelId } });
  await prisma.flowerItem.deleteMany({ where: { id: `${P}-item` } });
  await prisma.disposalCause.deleteMany({ where: { id: `${P}-cause` } });
  await prisma.user.deleteMany({ where: { id: { startsWith: `${P}-` } } });
  await prisma.branch.deleteMany({ where: { id: branchId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
}

async function seed() {
  await prisma.project.create({ data: { id: projectId, name: "T", description: "" } });
  await prisma.branch.create({ data: { id: branchId, name: `${P} 지점`, slug: `${P}-slug`, status: "active" } });
  await prisma.channel.create({ data: { id: channelId, projectId, branchId, name: "지점방", type: "branch" } });
  for (const u of [
    { id: authorId, email: `${P}-a@x.io`, name: "작성자", handle: `${P}_author`, passwordHash: "x", role: "member" },
    { id: managerId, email: `${P}-m@x.io`, name: "매니저", handle: `${P}_manager`, passwordHash: "x", role: "member" },
    { id: outsiderId, email: `${P}-o@x.io`, name: "외부", handle: `${P}_outsider`, passwordHash: "x", role: "member" },
    { id: adminId, email: `${P}-ad@x.io`, name: "관리자", handle: `${P}_admin`, passwordHash: "x", role: "admin" }
  ]) await prisma.user.create({ data: u });
  await prisma.branchAssignment.create({ data: { id: `${P}-asg`, userId: managerId, branchId, role: "manager" } });
  await prisma.flowerItem.create({ data: { id: `${P}-item`, name: "장미", isActive: true } });
  await prisma.disposalCause.create({ data: { id: `${P}-cause`, name: "수분과다", isActive: true } });
}

async function createReviewBatch(id) {
  return prisma.disposalBatch.create({
    data: {
      id, branchId, channelId: null, disposalDate: new Date("2026-06-20T00:00:00Z"),
      status: "review", reviewerId: managerId, reviewerName: "매니저", reviewRequestedAt: new Date(), createdById: authorId,
      lines: { create: buildDisposalLineData([{ itemName: "장미", quantity: 3, category: "기타", cause: "수분과다" }], new Map(), id) }
    },
    include: { lines: true }
  });
}

async function main() {
  await cleanup();
  await seed();

  // ── 1. 상태머신 (순수) ──
  await check("상태머신: 허용/차단 전이", async () => {
    assert.equal(canTransitionDisposal("draft", "review"), true);
    assert.equal(canTransitionDisposal("review", "submitted"), true);
    assert.equal(canTransitionDisposal("review", "rejected"), true);
    assert.equal(canTransitionDisposal("rejected", "review"), true); // 반려 후 재요청
    assert.equal(canTransitionDisposal("submitted", "review"), false); // 종착
    assert.equal(canTransitionDisposal("submitted", "draft"), false);
  });
  await check("normalizeAuthorStatus: 작성자는 submitted 직행 불가(=review)", async () => {
    assert.equal(normalizeAuthorStatus("submitted"), "review");
    assert.equal(normalizeAuthorStatus("review"), "review");
    assert.equal(normalizeAuthorStatus("draft"), "draft");
    assert.equal(normalizeAuthorStatus("xxx"), "draft");
  });

  // ── 2. 권한 (canApproveDisposal = 그 지점 매니저 또는 admin) ──
  await check("권한: 매니저=O, 외부=X(=403), admin=O, 작성자=X", async () => {
    assert.equal(await canApproveDisposal({ id: managerId, role: "member" }, branchId), true);
    assert.equal(await canApproveDisposal({ id: outsiderId, role: "member" }, branchId), false); // 라우트가 403
    assert.equal(await canApproveDisposal({ id: adminId, role: "admin" }, branchId), true);
    assert.equal(await canApproveDisposal({ id: authorId, role: "member" }, branchId), false);
    const mgrs = await branchManagers(branchId);
    assert.ok(mgrs.some((m) => m.id === managerId));
  });

  // ── 3. 검수요청 검증 게이트 ──
  await check("검증: 등록 품목·원인이면 통과, 미등록이면 오류", async () => {
    const ok = await validateDisposalForSubmit([{ itemName: "장미", quantity: 2, category: "기타", cause: "수분과다" }]);
    assert.equal(ok.length, 0);
    const bad = await validateDisposalForSubmit([{ itemName: "없는꽃", quantity: 2, category: "기타", cause: "수분과다" }]);
    assert.ok(bad.length > 0);
  });

  // ── 4. R4 자동 게시글: 검수요청 → 지점 채널 봇 메시지 ──
  const b1 = `${P}-b1`;
  let batch1 = await createReviewBatch(b1);
  await check("자동게시글: 검수요청 시 지점채널 봇 메시지 생성(구분묶음·담당매니저·상태)", async () => {
    const result = await postDisposalReviewRequest(batch1, { id: authorId, name: "작성자" });
    assert.ok(result.messageId, "messageId 세팅");
    const msg = await prisma.message.findUnique({ where: { id: result.messageId } });
    assert.ok(msg && msg.bot === true && msg.channelId === channelId);
    assert.match(msg.body, /\(기타\)/);
    assert.match(msg.body, /장미 3송이 \/ 수분과다/);
    assert.match(msg.body, /담당매니저 :/);
    assert.match(msg.body, /상태 : 검수대기/);
    const inDb = await prisma.disposalBatch.findUnique({ where: { id: b1 } });
    assert.equal(inDb.messageId, result.messageId);
    batch1 = await prisma.disposalBatch.findUnique({ where: { id: b1 }, include: { lines: true } });
  });
  await check("자동게시글: 재요청 시 새 글 안 만들고 기존 글 갱신(editedAt)·중복 0", async () => {
    await postDisposalReviewRequest(batch1, { id: authorId, name: "작성자" });
    const botMsgs = await prisma.message.count({ where: { channelId, bot: true } });
    assert.equal(botMsgs, 1, "검수 게시글은 1개(중복 생성 안 함)");
    const msg = await prisma.message.findUnique({ where: { id: batch1.messageId } });
    assert.ok(msg.editedAt, "editedAt 설정(=(수정됨))");
  });

  // ── 5. 승인 전이 + 경쟁 가드 + 결정 게시글 ──
  await check("승인: review→submitted + 승인자/승인일시 기록, 결정 메시지", async () => {
    const r = await prisma.disposalBatch.updateMany({
      where: { id: b1, status: "review" },
      data: { status: "submitted", approvedById: managerId, approvedByName: "매니저", approvedAt: new Date(), submittedAt: new Date(), rejectReason: null }
    });
    assert.equal(r.count, 1);
    const approved = await prisma.disposalBatch.findUnique({ where: { id: b1 }, include: { lines: true } });
    assert.equal(approved.status, "submitted");
    assert.equal(approved.approvedById, managerId);
    assert.equal(approved.approvedByName, "매니저");
    assert.ok(approved.approvedAt);
    await postDisposalDecision(approved, { actorName: "매니저", decision: "approved" });
    const last = await prisma.message.findFirst({ where: { channelId, bot: true }, orderBy: { createdAt: "desc" } });
    assert.match(last.body, /✅ 폐기 승인/);
  });
  await check("경쟁 가드: 이미 처리된 건 재승인 불가(updateMany count=0)", async () => {
    const again = await prisma.disposalBatch.updateMany({ where: { id: b1, status: "review" }, data: { status: "submitted" } });
    assert.equal(again.count, 0);
  });

  // ── 6. 반려 전이 + 사유 + 결정 게시글 ──
  const b2 = `${P}-b2`;
  const batch2 = await createReviewBatch(b2);
  await postDisposalReviewRequest(batch2, { id: authorId, name: "작성자" });
  await check("반려: review→rejected + rejectReason 저장, 반려 메시지(사유)", async () => {
    const r = await prisma.disposalBatch.updateMany({
      where: { id: b2, status: "review" },
      data: { status: "rejected", rejectReason: "사진 누락" }
    });
    assert.equal(r.count, 1);
    const rejected = await prisma.disposalBatch.findUnique({ where: { id: b2 }, include: { lines: true } });
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejectReason, "사진 누락");
    await postDisposalDecision(rejected, { actorName: "매니저", decision: "rejected", reason: rejected.rejectReason });
    const last = await prisma.message.findFirst({ where: { channelId, bot: true }, orderBy: { createdAt: "desc" } });
    assert.match(last.body, /❌ 폐기 반려/);
    assert.match(last.body, /사유: 사진 누락/);
    assert.equal(canTransitionDisposal(rejected.status, "review"), true); // 작성자 재요청 가능(백엔드)
  });

  // ── 7. 포매터(순수) 산출물 ──
  await check("formatDisposalPostBody: 구분별 묶음 + 상태 라벨", async () => {
    const body = formatDisposalPostBody({
      authorName: "작성자", branchName: "강남1호점", disposalDate: "2026-06-20",
      lines: [{ itemName: "장미", quantity: 3, unit: "송이", category: "기타", cause: "수분과다" }],
      managerHandle: "@manager", status: "review", attachmentCount: 2
    });
    assert.match(body, /\(기타\)/);
    assert.match(body, /첨부사진 2장/);
    assert.match(body, /상태 : 검수대기/);
  });

  await cleanup();
  console.log(`\n폐기 검수·승인 흐름 테스트 통과: ${passed}건`);
}

main()
  .catch(async (error) => { console.error("FAILED:", error); await cleanup().catch(() => {}); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
