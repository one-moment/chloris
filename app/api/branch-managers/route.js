// 지점 매니저 관리 API (admin 전용, 보로 게이팅) — 목록 / 신규 지정.
// 범위 수정·해제는 [userId]/route.js (PATCH). 코드 로직은 lib/branchManagerAdmin.js.
// 마이그레이션 선적용 전(신규 컬럼 부재)에는 목록을 빈 배열로 degrade.
import { requireCurrentUser } from "../../../lib/auth";
import { badRequest } from "../../../lib/serverState";
import { isModuleEnabled } from "../../../lib/brand";
import { listManagers, assignManager, isMissingBranchManagerSchema } from "../../../lib/branchManagerAdmin";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function guard(user) {
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });
  if (!isModuleEnabled("branch-admin")) return Response.json({ error: "Not enabled." }, { status: 404 });
  return null;
}

export async function GET() {
  const user = await requireCurrentUser();
  const denied = guard(user);
  if (denied) return denied;

  try {
    const managers = await listManagers();
    return Response.json({ managers });
  } catch (error) {
    if (isMissingBranchManagerSchema(error)) return Response.json({ managers: [], schemaReady: false });
    throw error;
  }
}

export async function POST(request) {
  const user = await requireCurrentUser();
  const denied = guard(user);
  if (denied) return denied;

  const body = await request.json();
  const userId = (body.userId ?? "").toString().trim();
  if (!userId) return badRequest("userId가 필요합니다.");

  const result = await assignManager({
    userId,
    isAllBranches: Boolean(body.isAllBranches),
    branchIds: Array.isArray(body.branchIds) ? body.branchIds : [],
    actorId: user.id
  });
  if (result.error) return Response.json({ error: result.error }, { status: result.status ?? 400 });
  return Response.json({ ok: true }, { status: 201 });
}
