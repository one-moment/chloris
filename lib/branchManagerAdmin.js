// 지점 매니저 관리 — 코어 서버 헬퍼 (BranchAssignment 재사용, PLAN v5).
// 매니저 = BranchAssignment(role="manager"). 전 지점 매니저 = + isAllBranches=true, branchId=null.
// supervisor = 전 지점 매니저 중 User.role!=="admin" (별도 enum/컬럼 없음 — UI 라벨).
// 불변식 [B]: 전 지점 행과 특정지점 행은 한 사용자에게 공존 금지. @@unique 가 NULL 중복을 못 막으므로
// 앱 레벨에서 재조정(reconcile)으로 보장한다. 감사 [E]: assignedById(최초 임명)/updatedById(마지막 변경)·updatedAt.
import { prisma } from "./prisma";

function genId() {
  return `branch-assignment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// 마이그레이션 선적용 전(신규 컬럼 부재) graceful degrade 판별.
export function isMissingBranchManagerSchema(error) {
  const message = String(error?.message ?? "");
  return error?.code === "P2021"
    || error?.code === "P2022"
    || message.includes("isAllBranches")
    || message.includes("BranchAssignment");
}

// 지정 범위 검증. isAllBranches=true 면 branchIds 무시. 아니면 branchIds 는 유효한 지점 1개 이상.
async function validateScope({ isAllBranches, branchIds }) {
  if (isAllBranches) return { isAllBranches: true, branchIds: [] };
  const ids = Array.isArray(branchIds) ? [...new Set(branchIds.filter(Boolean))] : [];
  if (ids.length === 0) return { error: "지점을 한 개 이상 선택하거나 '전 지점'을 지정하세요." };
  const found = await prisma.branch.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (found.length !== ids.length) return { error: "존재하지 않는 지점이 포함되어 있습니다." };
  return { isAllBranches: false, branchIds: ids };
}

// 한 사용자의 매니저 배정을 목표 범위로 재조정한다(불변식 [B] 보장). assign·범위수정 공용.
async function reconcileScope({ userId, isAllBranches, branchIds, actorId }) {
  const existing = await prisma.branchAssignment.findMany({ where: { userId } });
  const ops = [];

  if (isAllBranches) {
    const allRow = existing.find((row) => row.branchId === null);
    if (allRow) {
      ops.push(prisma.branchAssignment.update({
        where: { id: allRow.id },
        data: { role: "manager", isAllBranches: true, updatedById: actorId }
      }));
    } else {
      ops.push(prisma.branchAssignment.create({
        data: { id: genId(), userId, branchId: null, role: "manager", isAllBranches: true, assignedById: actorId, updatedById: actorId }
      }));
    }
    // 전 지점 지정 → 기존 특정지점 매니저 행은 staff 로 강등(상호배타 [B]).
    for (const row of existing) {
      if (row.branchId !== null && row.role === "manager") {
        ops.push(prisma.branchAssignment.update({ where: { id: row.id }, data: { role: "staff", isAllBranches: false, updatedById: actorId } }));
      }
    }
  } else {
    const target = new Set(branchIds);
    const allRow = existing.find((row) => row.branchId === null);
    if (allRow && allRow.role === "manager") {
      ops.push(prisma.branchAssignment.update({ where: { id: allRow.id }, data: { role: "staff", isAllBranches: false, updatedById: actorId } }));
    }
    for (const branchId of target) {
      const row = existing.find((item) => item.branchId === branchId);
      if (row) {
        ops.push(prisma.branchAssignment.update({ where: { id: row.id }, data: { role: "manager", isAllBranches: false, updatedById: actorId } }));
      } else {
        ops.push(prisma.branchAssignment.create({ data: { id: genId(), userId, branchId, role: "manager", isAllBranches: false, assignedById: actorId, updatedById: actorId } }));
      }
    }
    // 더 이상 담당하지 않는 특정지점 매니저 행은 staff 로 강등.
    for (const row of existing) {
      if (row.branchId !== null && row.role === "manager" && !target.has(row.branchId)) {
        ops.push(prisma.branchAssignment.update({ where: { id: row.id }, data: { role: "staff", isAllBranches: false, updatedById: actorId } }));
      }
    }
  }

  await prisma.$transaction(ops);
}

async function userIsManager(userId) {
  const row = await prisma.branchAssignment.findFirst({ where: { userId, role: "manager" }, select: { id: true } });
  return Boolean(row);
}

// 신규 매니저 지정. 이미 매니저면 409(범위 수정 사용). 반환 { error?, status? }.
export async function assignManager({ userId, isAllBranches = false, branchIds = [], actorId }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return { error: "사용자를 찾을 수 없습니다.", status: 404 };
  if (await userIsManager(userId)) return { error: "이미 매니저입니다. 범위 수정을 사용하세요.", status: 409 };

  const scope = await validateScope({ isAllBranches, branchIds });
  if (scope.error) return { error: scope.error, status: 400 };

  await reconcileScope({ userId, ...scope, actorId });
  return { ok: true };
}

// 기존 매니저의 담당 범위 수정. 매니저가 아니면 404.
export async function updateManagerScope({ userId, isAllBranches = false, branchIds = [], actorId }) {
  if (!(await userIsManager(userId))) return { error: "매니저가 아닙니다.", status: 404 };

  const scope = await validateScope({ isAllBranches, branchIds });
  if (scope.error) return { error: scope.error, status: 400 };

  await reconcileScope({ userId, ...scope, actorId });
  return { ok: true };
}

// 해제 = 매니저 행 전부 staff 강등(행 삭제 없음, 되돌리기 가능 [결정 4]).
export async function unassignManager({ userId, actorId }) {
  const rows = await prisma.branchAssignment.findMany({ where: { userId, role: "manager" }, select: { id: true } });
  if (rows.length === 0) return { error: "매니저가 아닙니다.", status: 404 };
  await prisma.branchAssignment.updateMany({
    where: { userId, role: "manager" },
    data: { role: "staff", isAllBranches: false, updatedById: actorId }
  });
  return { ok: true };
}

// 매니저 목록(사용자 단위 그룹). [{ userId, user, isAllBranches, branches, updatedAt, assignedBy, updatedBy }].
export async function listManagers() {
  const rows = await prisma.branchAssignment.findMany({
    where: { role: "manager" },
    include: {
      user: { select: { id: true, name: true, handle: true, email: true, role: true } },
      branch: { select: { id: true, name: true } }
    }
  });

  // 감사 actor id → 이름 best-effort 매핑(scalar id라 FK 없음).
  const actorIds = [...new Set(rows.flatMap((row) => [row.assignedById, row.updatedById]).filter(Boolean))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const actorName = new Map(actors.map((actor) => [actor.id, actor.name]));

  const byUser = new Map();
  for (const row of rows) {
    if (!row.user) continue;
    const entry = byUser.get(row.user.id) ?? {
      userId: row.user.id,
      user: row.user,
      isAllBranches: false,
      branches: [],
      updatedAt: null,
      assignedById: null,
      updatedById: null
    };
    if (row.isAllBranches) entry.isAllBranches = true;
    if (row.branch) entry.branches.push({ id: row.branch.id, name: row.branch.name });
    // 가장 최근 변경 행 기준으로 감사 표기.
    if (!entry.updatedAt || (row.updatedAt && row.updatedAt > entry.updatedAt)) {
      entry.updatedAt = row.updatedAt;
      entry.assignedById = row.assignedById;
      entry.updatedById = row.updatedById;
    }
    byUser.set(row.user.id, entry);
  }

  return [...byUser.values()]
    .map((entry) => ({
      userId: entry.userId,
      user: entry.user,
      isAllBranches: entry.isAllBranches,
      branches: entry.isAllBranches ? [] : entry.branches.sort((a, b) => a.name.localeCompare(b.name, "ko")),
      updatedAt: entry.updatedAt ? entry.updatedAt.toISOString() : null,
      assignedByName: entry.assignedById ? actorName.get(entry.assignedById) ?? null : null,
      updatedByName: entry.updatedById ? actorName.get(entry.updatedById) ?? null : null
    }))
    .sort((a, b) => a.user.name.localeCompare(b.user.name, "ko"));
}
