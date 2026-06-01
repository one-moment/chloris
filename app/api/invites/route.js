import { createSecureToken, hashSecret, normalizeEmail, requireCurrentUser } from "../../../lib/auth";
import { badRequest } from "../../../lib/serverState";
import { prisma } from "../../../lib/prisma";

function serializeInvite(invite) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
    usedAt: invite.usedAt,
    usedById: invite.usedById,
    createdAt: invite.createdAt
  };
}

export async function GET() {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin role required." }, { status: 403 });

  const invites = await prisma.invite.findMany({ orderBy: { createdAt: "desc" } });
  return Response.json({ invites: invites.map(serializeInvite) });
}

export async function POST(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin role required." }, { status: 403 });

  const { email, role = "member", expiresInDays = 7 } = await request.json();
  if (!["member", "admin"].includes(role)) return badRequest("Invalid role.");

  const code = createSecureToken(18);
  const expiresAt = expiresInDays
    ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
    : null;

  const invite = await prisma.invite.create({
    data: {
      id: `invite-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      codeHash: hashSecret(code),
      email: email ? normalizeEmail(email) : null,
      role,
      expiresAt,
      createdById: user.id
    }
  });

  return Response.json({
    invite: serializeInvite(invite),
    code
  }, { status: 201 });
}
