// 지점 매니저 관리 + 전 지점(isAllBranches) #27 연동 회귀 테스트 (로컬 sqlite, 1회 실행 — 무인 루프 금지).
// 실행: npx tsx scripts/test-branch-manager.mjs   (사전: db push 로 dev.db 에 신규 컬럼 동기화)
// 실제 병합 헬퍼를 호출해 검증한다: lib/branchManagerAdmin(지정·범위수정·해제·불변식[B]) +
// lib/inventoryServer(branchManagers / canApproveDisposal 의 전 지점 OR 확장, PLAN §4·§9-5).
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma.js";
import { branchManagers, allBranchManagers, canApproveDisposal } from "../lib/inventoryServer.js";
import { assignManager, updateManagerScope, unassignManager, listManagers } from "../lib/branchManagerAdmin.js";

const P = "bm"; // 테스트 행 prefix(정리용)
const branchA = `${P}-branch-a`, branchB = `${P}-branch-b`;
const adminId = `${P}-admin`, mgrAId = `${P}-mgr-a`, supId = `${P}-sup`, outsiderId = `${P}-outsider`;

let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`  ✓ ${name}`); }

async function cleanup() {
  await prisma.branchAssignment.deleteMany({ where: { userId: { startsWith: `${P}-` } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: `${P}-` } } });
  await prisma.branch.deleteMany({ where: { id: { startsWith: `${P}-` } } });
}

async function seed() {
  await prisma.branch.create({ data: { id: branchA, name: `${P} 지점A`, slug: `${P}-a`, status: "active" } });
  await prisma.branch.create({ data: { id: branchB, name: `${P} 지점B`, slug: `${P}-b`, status: "active" } });
  for (const u of [
    { id: adminId, email: `${P}-ad@x.io`, name: "관리자", handle: `${P}_admin`, passwordHash: "x", role: "admin" },
    { id: mgrAId, email: `${P}-ma@x.io`, name: "A매니저", handle: `${P}_mgr_a`, passwordHash: "x", role: "member" },
    { id: supId, email: `${P}-su@x.io`, name: "수퍼바이저", handle: `${P}_sup`, passwordHash: "x", role: "member" },
    { id: outsiderId, email: `${P}-ou@x.io`, name: "외부", handle: `${P}_outsider`, passwordHash: "x", role: "member" }
  ]) await prisma.user.create({ data: u });
}

const userObj = (id, role) => ({ id, role });

async function main() {
  console.log("지점 매니저 관리 회귀 테스트");
  await cleanup();
  await seed();

  // ── 지정 (lib/branchManagerAdmin) ─────────────────────────────────────────
  await check("특정지점 매니저 지정(A)", async () => {
    const res = await assignManager({ userId: mgrAId, branchIds: [branchA], actorId: adminId });
    assert.equal(res.ok, true);
  });
  await check("전 지점 매니저(supervisor) 지정", async () => {
    const res = await assignManager({ userId: supId, isAllBranches: true, actorId: adminId });
    assert.equal(res.ok, true);
  });
  await check("이미 매니저면 지정 거부(409)", async () => {
    const res = await assignManager({ userId: supId, branchIds: [branchA], actorId: adminId });
    assert.equal(res.status, 409);
  });
  await check("존재하지 않는 지점 지정 거부(400)", async () => {
    const res = await assignManager({ userId: outsiderId, branchIds: ["no-such-branch"], actorId: adminId });
    assert.equal(res.status, 400);
  });

  // ── §9-5 branchManagers: 전 지점 매니저는 모든 지점 풀에 포함 ───────────────
  await check("branchManagers(A) = 특정A매니저 + 전지점매니저", async () => {
    const ids = (await branchManagers(branchA)).map((m) => m.id).sort();
    assert.deepEqual(ids, [mgrAId, supId].sort());
  });
  await check("branchManagers(B) = 전지점매니저만 (특정A매니저 제외)", async () => {
    const ids = (await branchManagers(branchB)).map((m) => m.id);
    assert.deepEqual(ids, [supId]);
  });
  await check("branchManagers(null) = [] (early-return 유지)", async () => {
    assert.deepEqual(await branchManagers(null), []);
  });
  await check("allBranchManagers: 전지점매니저는 활성지점마다 전개(폼 드롭다운 노출)", async () => {
    const all = await allBranchManagers();
    const forA = all.filter((m) => m.branchId === branchA).map((m) => m.id);
    const forB = all.filter((m) => m.branchId === branchB).map((m) => m.id);
    assert.ok(forA.includes(mgrAId) && forA.includes(supId), "A = 특정A매니저 + 전지점매니저");
    assert.ok(forB.includes(supId) && !forB.includes(mgrAId), "B = 전지점매니저만 (특정A 제외)");
  });

  // ── canApproveDisposal: admin / 특정 / 전지점 / 외부 ───────────────────────
  await check("admin 은 모든 지점 승인", async () => {
    assert.equal(await canApproveDisposal(userObj(adminId, "admin"), branchA), true);
    assert.equal(await canApproveDisposal(userObj(adminId, "admin"), branchB), true);
  });
  await check("특정A매니저 = A 승인 O / B 승인 X", async () => {
    assert.equal(await canApproveDisposal(userObj(mgrAId, "member"), branchA), true);
    assert.equal(await canApproveDisposal(userObj(mgrAId, "member"), branchB), false);
  });
  await check("전지점매니저(supervisor) = 모든 지점 승인", async () => {
    assert.equal(await canApproveDisposal(userObj(supId, "member"), branchA), true);
    assert.equal(await canApproveDisposal(userObj(supId, "member"), branchB), true);
  });
  await check("외부 사용자 = 승인 불가", async () => {
    assert.equal(await canApproveDisposal(userObj(outsiderId, "member"), branchA), false);
  });

  // ── 불변식 [B]: 전 지점 전환 시 특정지점 매니저 행 강등 ─────────────────────
  await check("A매니저 → 전 지점 전환 시 특정A행 staff 강등(상호배타)", async () => {
    const res = await updateManagerScope({ userId: mgrAId, isAllBranches: true, actorId: adminId });
    assert.equal(res.ok, true);
    const specificManagerRows = await prisma.branchAssignment.count({ where: { userId: mgrAId, role: "manager", branchId: { not: null } } });
    assert.equal(specificManagerRows, 0);
    assert.equal(await canApproveDisposal(userObj(mgrAId, "member"), branchB), true); // 이제 전 지점
  });

  // ── 목록 ──────────────────────────────────────────────────────────────────
  await check("listManagers = supervisor/관리 대상 노출", async () => {
    const list = await listManagers();
    const sup = list.find((m) => m.userId === supId);
    assert.ok(sup && sup.isAllBranches === true);
  });

  // ── 해제 = staff 강등(행 보존) ─────────────────────────────────────────────
  await check("해제 시 매니저 풀에서 빠지고 staff 행은 남음", async () => {
    const res = await unassignManager({ userId: supId, actorId: adminId });
    assert.equal(res.ok, true);
    assert.equal((await branchManagers(branchA)).some((m) => m.id === supId), false);
    const staffRows = await prisma.branchAssignment.count({ where: { userId: supId, role: "staff" } });
    assert.ok(staffRows >= 1);
  });

  await cleanup();
  console.log(`\n${passed}개 통과`);
}

main()
  .catch((error) => { console.error("✗ 실패:", error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
