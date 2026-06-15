// 폐기 구분/원인 목록 API (보로 전용 inventory 모듈). 폐기 폼의 드롭다운 소스.
// 구분(category)은 고정 상수, 폐기원인(cause)은 DisposalCause 마스터(관리자 관리).
// 마이그레이션 적용 전에는 causes를 빈 배열로 degrade(구분은 항상 반환).
import { requireCurrentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { isModuleEnabled } from "../../../../../lib/brand";
import { DISPOSAL_CATEGORIES } from "../../../../../lib/inventory";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function isMissingTableError(error) {
  const message = String(error?.message ?? "");
  return error?.code === "P2021" || message.includes("DisposalCause");
}

export async function GET() {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!isModuleEnabled("disposal")) return Response.json({ categories: DISPOSAL_CATEGORIES, causes: [] });

  try {
    const causes = await prisma.disposalCause.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
    return Response.json({
      categories: DISPOSAL_CATEGORIES,
      causes: causes.map((cause) => cause.name)
    });
  } catch (error) {
    if (isMissingTableError(error)) return Response.json({ categories: DISPOSAL_CATEGORIES, causes: [] });
    throw error;
  }
}
