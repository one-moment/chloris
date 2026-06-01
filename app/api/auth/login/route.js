import { NextResponse } from "next/server";
import { badRequest } from "../../../../lib/serverState";
import { createSession, normalizeEmail, serializeUser, setSessionCookie, verifyPassword } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function POST(request) {
  const { email, password } = await request.json();
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return badRequest("Email or password is incorrect.");
  }

  const { token, expiresAt } = await createSession(user.id);
  const response = NextResponse.json({ user: serializeUser(user) });
  setSessionCookie(response, token, expiresAt);
  return response;
}
