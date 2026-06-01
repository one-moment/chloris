import { NextResponse } from "next/server";
import { badRequest } from "../../../../lib/serverState";
import { createSession, hashPassword, hashSecret, normalizeEmail, normalizeHandle, serializeUser, setSessionCookie } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

function handleFromEmail(email) {
  return email.split("@")[0];
}

export async function POST(request) {
  const { name, email, handle, password, inviteCode } = await request.json();
  const normalizedEmail = normalizeEmail(email);
  const normalizedHandle = normalizeHandle(handle, handleFromEmail(normalizedEmail));
  const displayName = String(name ?? "").trim();

  if (!displayName) return badRequest("Name is required.");
  if (!normalizedEmail.includes("@")) return badRequest("Valid email is required.");
  if (normalizedHandle.length < 3) return badRequest("Handle is required.");
  if (String(password ?? "").length < 6) return badRequest("Password must be at least 6 characters.");

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: normalizedEmail }, { handle: normalizedHandle }] }
  });
  if (existing) return badRequest("Email or handle is already in use.");

  const userCount = await prisma.user.count();
  let invite = null;
  if (inviteCode) {
    invite = await prisma.invite.findUnique({ where: { codeHash: hashSecret(inviteCode) } });
    if (!invite || invite.usedAt || (invite.expiresAt && invite.expiresAt <= new Date())) {
      return badRequest("Invite code is invalid or expired.");
    }
    if (invite.email && invite.email !== normalizedEmail) {
      return badRequest("Invite code is not valid for this email.");
    }
  }

  if (process.env.ALLOW_PUBLIC_SIGNUP === "false" && userCount > 0 && !invite) {
    return Response.json({ error: "Invite code is required." }, { status: 403 });
  }

  const user = await prisma.user.create({
    data: {
      id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      email: normalizedEmail,
      name: displayName,
      handle: normalizedHandle,
      passwordHash: hashPassword(password),
      role: userCount === 0 ? "admin" : (invite?.role ?? "member")
    }
  });

  if (invite) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: {
        usedAt: new Date(),
        usedById: user.id
      }
    });
  }

  const { token, expiresAt } = await createSession(user.id);
  const response = NextResponse.json({ user: serializeUser(user) }, { status: 201 });
  setSessionCookie(response, token, expiresAt);
  return response;
}
