import { pbkdf2Sync, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "om_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 120000;

function nowId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createSecureToken(bytes = 24) {
  return randomBytes(bytes).toString("hex");
}

export function hashSecret(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export function normalizeHandle(handle, fallback = "") {
  const raw = String(handle || fallback || "").trim().toLowerCase();
  const compact = raw.replace(/[^a-z0-9가-힣._-]/g, "");
  return compact.startsWith("@") ? compact : `@${compact.replace(/^@+/, "")}`;
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, "sha256").toString("hex");
  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${derived}`;
}

export function verifyPassword(password, storedHash) {
  const [scheme, iterationsText, salt, expected] = String(storedHash ?? "").split("$");
  if (scheme !== "pbkdf2" || !iterationsText || !salt || !expected) return false;
  const actual = pbkdf2Sync(password, salt, Number(iterationsText), 32, "sha256");
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && timingSafeEqual(expectedBuffer, actual);
}

export function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    handle: user.handle,
    role: user.role
  };
}

export async function createSession(userId) {
  const token = createSecureToken(32);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await prisma.session.create({
    data: {
      id: nowId("session"),
      userId,
      tokenHash: hashSecret(token),
      expiresAt
    }
  });
  return { token, expiresAt };
}

export function setSessionCookie(response, token, expiresAt) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSecret(token) },
    include: { user: true }
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  return user ? serializeUser(user) : null;
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashSecret(token) } });
}
