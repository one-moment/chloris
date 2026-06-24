// 지점 매니저 범위 수정 / 해제 API (admin 전용, 보로 게이팅). 리소스 = 사용자(userId).
//   PATCH { action:"unassign" }         → 매니저 행 전부 staff 강등(해제, 되돌리기 가능)
//   PATCH { isAllBranches, branchIds }  → 담당 범위 수정(재조정, 불변식 [B])
import { requireCurrentUser } from "../../../../lib/auth";
import { isModuleEnabled } from "../../../../lib/brand";
import { updateManagerScope, unassignManager } from "../../../../lib/branchManagerAdmin";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });
  if (!isModuleEnabled("branch-admin")) return Response.json({ error: "Not enabled." }, { status: 404 });

  const { userId } = await params;
  const body = await request.json();

  const result = body.action === "unassign"
    ? await unassignManager({ userId, actorId: user.id })
    : await updateManagerScope({
        userId,
        isAllBranches: Boolean(body.isAllBranches),
        branchIds: Array.isArray(body.branchIds) ? body.branchIds : [],
        actorId: user.id
      });

  if (result.error) return Response.json({ error: result.error }, { status: result.status ?? 400 });
  return Response.json({ ok: true });
}
