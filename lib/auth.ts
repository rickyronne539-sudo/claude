import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";

export const SESSION_COOKIE_NAME = "claude_academy_session";

const BCRYPT_ROUNDS = 12;
const SESSION_DAYS = { remember: 30, normal: 1 };
const LAST_SEEN_EVERY_MS = 10 * 60 * 1000;

// ── Passwords ──────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Compared against when an email doesn't exist, so a wrong email takes as long as a
// wrong password and response times don't reveal who has an account.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-" + crypto.randomBytes(8).toString("hex"), BCRYPT_ROUNDS);

/** Checks a password without revealing whether the account exists. */
export async function checkPassword(password: string, hash: string | null | undefined) {
  const ok = await bcrypt.compare(password, hash || DUMMY_HASH);
  return Boolean(hash) && ok;
}

// ── Tokens ─────────────────────────────────────────────────────────────────

export const randomToken = () => crypto.randomBytes(32).toString("base64url");

/** Only hashes of session and reset tokens are stored, so a database leak can't be used to sign in. */
export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

// ── Request details ────────────────────────────────────────────────────────

export function clientIp(req: NextRequest | Request) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim().slice(0, 64);
}

export function appUrl(req: NextRequest) {
  return (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, "");
}

// ── Sessions ───────────────────────────────────────────────────────────────

export async function createSession(userId: string, rememberMe: boolean, req?: NextRequest) {
  const token = randomToken();
  const days = rememberMe ? SESSION_DAYS.remember : SESSION_DAYS.normal;
  const expiresAt = new Date(Date.now() + days * 86400_000);

  await prisma.session.create({
    data: {
      sessionToken: hashToken(token),
      userId,
      expiresAt,
      rememberMe,
      userAgent: req?.headers.get("user-agent")?.slice(0, 300) ?? null,
      ipAddress: req ? clientIp(req) : null,
    },
  });

  // Now and then, clear out expired sessions.
  if (Math.random() < 0.05) {
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
  }

  return { sessionToken: token, expiresAt, maxAge: days * 86400 };
}

/** Sets the session cookie on a response. */
export function setSessionCookie(res: NextResponse, token: string, maxAge: number) {
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({ name: SESSION_COOKIE_NAME, value: "", path: "/", maxAge: 0 });
}

export async function getSessionUser(token?: string) {
  if (!token || token.length > 200) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: hashToken(token) },
    include: { user: { include: { enrollments: true } } },
  });
  if (!session) return null;

  if (new Date() > session.expiresAt) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_EVERY_MS) {
    prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }

  const u = session.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    rememberMe: session.rememberMe,
    sessionId: session.id,
    hasPassword: Boolean(u.passwordHash),
    emailVerified: Boolean(u.emailVerifiedAt),
    googleLinked: Boolean(u.googleId),
    enrollments: u.enrollments,
  };
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

/** The signed-in user for an API request, or null. */
export async function userFromRequest(req: NextRequest) {
  return getSessionUser(req.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({ where: { sessionToken: hashToken(token) } });
}

/** Signs the user out everywhere (optionally keeping one session, e.g. the current one). */
export async function revokeSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.deleteMany({
    where: { userId, ...(exceptSessionId && { id: { not: exceptSessionId } }) },
  });
}

/** Fields safe to send to the browser about the signed-in user. */
export function publicUser(u: SessionUser) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    hasPassword: u.hasPassword,
    emailVerified: u.emailVerified,
    googleLinked: u.googleLinked,
  };
}

/** Standard reply when the database can't be reached. */
export const DB_UNAVAILABLE = {
  error: "The service is temporarily unavailable. Please try again in a moment.",
};
