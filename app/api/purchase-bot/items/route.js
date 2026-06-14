import { requireCurrentUser } from "../../../../lib/auth";
import { parseAliases } from "../../../../lib/purchaseBot/parser";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function serializeItem(item) {
  return {
    ...item,
    aliases: parseAliases(item.aliasesJson),
    aliasesJson: undefined
  };
}

export async function GET() {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const items = await prisma.purchaseItem.findMany({ orderBy: { name: "asc" } });
  return Response.json({ items: items.map(serializeItem) });
}
