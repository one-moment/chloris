import { requireCurrentUser } from "../../../../lib/auth";
import { badRequest, notFound } from "../../../../lib/serverState";
import { prisma } from "../../../../lib/prisma";

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

function canManage(user, template) {
  if (user.role === "admin") return true;
  if (template.scope === "shared") return false;
  return template.ownerId === user.id;
}

export async function PATCH(request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { templateId } = await params;
  const existing = await prisma.postTemplate.findUnique({ where: { id: templateId } });
  if (!existing) return notFound("Template not found.");
  if (!canManage(user, existing)) return Response.json({ error: "You cannot edit this template." }, { status: 403 });

  const { name, body, scope } = await request.json();
  const data = {};
  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) return badRequest("Template name is required.");
    data.name = trimmed;
  }
  if (body !== undefined) {
    const trimmed = body.trim();
    if (!trimmed) return badRequest("Template body is required.");
    data.body = trimmed;
  }
  if (scope !== undefined) {
    if (scope !== "personal" && scope !== "shared") return badRequest("Invalid template scope.");
    if (scope === "shared" && user.role !== "admin") {
      return Response.json({ error: "Only admins can publish shared templates." }, { status: 403 });
    }
    data.scope = scope;
    data.ownerId = scope === "personal" ? (existing.ownerId ?? user.id) : null;
  }
  if (Object.keys(data).length === 0) return badRequest("No changes provided.");

  const updated = await prisma.postTemplate.update({ where: { id: templateId }, data });
  return Response.json(serialize(updated));
}

export async function DELETE(_request, { params }) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { templateId } = await params;
  const existing = await prisma.postTemplate.findUnique({ where: { id: templateId } });
  if (!existing) return notFound("Template not found.");
  if (!canManage(user, existing)) return Response.json({ error: "You cannot delete this template." }, { status: 403 });

  await prisma.postTemplate.delete({ where: { id: templateId } });
  return Response.json({ ok: true, deletedId: templateId });
}
