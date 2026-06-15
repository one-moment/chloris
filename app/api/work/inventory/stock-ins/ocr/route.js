// 거래명세서 사진 OCR API (보로 inventory 모듈). 업로드된 명세서 이미지 URL을 받아 Vision으로
// 품목 라인을 추출해 입고 표를 사전채움한다. 키 미설정/추출 실패 시 degraded:true + 빈 라인으로
// degrade → 폼은 수기 입력으로 진행. 설계: docs/inventory-stockin-disposal.md §9
import { requireCurrentUser } from "../../../../../../lib/auth";
import { isModuleEnabled } from "../../../../../../lib/brand";
import { extractStatementLineItems } from "../../../../../../lib/agents/openaiClient";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function normalizeLines(parsed) {
  const lines = Array.isArray(parsed?.lines) ? parsed.lines : [];
  return lines
    .map((line) => ({
      itemName: String(line?.itemName ?? "").trim(),
      quantity: Number(line?.quantity) || 0,
      unitPrice: Number(line?.unitPrice) || 0,
      note: line?.note ? String(line.note).trim() : null
    }))
    .filter((line) => line.itemName);
}

export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!isModuleEnabled("stockin")) return Response.json({ error: "Stock-in module is not enabled." }, { status: 404 });

  const { imageUrl } = await request.json();
  if (!imageUrl) return Response.json({ error: "imageUrl이 필요합니다." }, { status: 400 });

  let extraction;
  try {
    extraction = await extractStatementLineItems({ imageUrl });
  } catch {
    return Response.json({ degraded: true, reason: "ocr_failed", lines: [] });
  }

  if (extraction.skipped) {
    return Response.json({ degraded: true, reason: extraction.reason ?? "ocr_unavailable", lines: [] });
  }
  if (extraction.parseError || !extraction.result) {
    return Response.json({ degraded: true, reason: "parse_failed", lines: [] });
  }

  const parsed = extraction.result;
  return Response.json({
    degraded: false,
    supplier: parsed.supplier ?? null,
    statementDate: parsed.statementDate ?? null,
    lines: normalizeLines(parsed)
  });
}
