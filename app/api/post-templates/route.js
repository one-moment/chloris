import { requireCurrentUser } from "../../../lib/auth";
import { badRequest } from "../../../lib/serverState";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

function serialize(template) {
  return {
    id: template.id,
    name: template.name,
    body: template.body,
    scope: template.scope,
    ownerId: template.ownerId,
    createdById: template.createdById
  };
}

function isMissingTableError(error) {
  return error?.code === "P2021" || String(error?.message ?? "").includes("PostTemplate");
}

export async function GET() {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  try {
    const rows = await prisma.postTemplate.findMany({
      where: { OR: [{ scope: "shared" }, { ownerId: user.id }] },
      orderBy: [{ scope: "asc" }, { name: "asc" }]
    });
    return Response.json({ templates: rows.map(serialize) });
  } catch (error) {
    if (isMissingTableError(error)) return Response.json({ templates: [] });
    throw error;
  }
}

export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { name, body, scope = "personal" } = await request.json();
  const trimmedName = name?.trim();
  const trimmedBody = body?.trim();
  if (!trimmedName) return badRequest("Template name is required.");
  if (!trimmedBody) return badRequest("Template body is required.");
  if (scope !== "personal" && scope !== "shared") return badRequest("Invalid template scope.");
  if (scope === "shared" && user.role !== "admin") {
    return Response.json({ error: "Only admins can create shared templates." }, { status: 403 });
  }

  const created = await prisma.postTemplate.create({
    data: {
      id: `tmpl-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmedName,
      body: trimmedBody,
      scope,
      ownerId: scope === "personal" ? user.id : null,
      createdById: user.id
    }
  });

  return Response.json(serialize(created), { status: 201 });
}
