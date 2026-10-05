import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appUrl, createSession, revokeSessions, setSessionCookie } from "@/lib/auth";
import { GOOGLE_STATE_COOKIE, googleConfigured, googleProfileFromCode } from "@/lib/google";

function fail(req: NextRequest, reason: string) {
  const res = NextResponse.redirect(new URL(`/?auth_error=${reason}`, appUrl(req)));
  res.cookies.set({ name: GOOGLE_STATE_COOKIE, value: "", path: "/api/auth/google", maxAge: 0 });
  return res;
}

const same = (a: string, b: string) =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// GET — Google sends the user back here after they choose an account.
export async function GET(req: NextRequest) {
  if (!googleConfigured()) return fail(req, "google_unavailable");

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail(req, "google_cancelled");

  let saved: { state?: string; verifier?: string; rememberMe?: boolean } = {};
  try {
    saved = JSON.parse(req.cookies.get(GOOGLE_STATE_COOKIE)?.value || "{}");
  } catch {}
  const state = params.get("state") || "";
  const code = params.get("code") || "";
  if (!saved.state || !saved.verifier || !code || !same(state, saved.state)) return fail(req, "google_failed");

  try {
    const profile = await googleProfileFromCode(code, saved.verifier, appUrl(req));
    if (!profile.email_verified) return fail(req, "google_unverified");

    let user = await prisma.user.findFirst({ where: { googleId: profile.sub } });
    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
      if (byEmail) {
        // Link Google to the existing account. If that account's email was never proven,
        // someone else may have registered it first, so their password is removed and
        // all existing sessions end. The owner can add a password again from their account.
        const unproven = !byEmail.emailVerifiedAt;
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: profile.sub,
            emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
            ...(unproven && byEmail.passwordHash && { passwordHash: null, passwordChangedAt: new Date() }),
          },
        });
        if (unproven) await revokeSessions(user.id);
      } else {
        user = await prisma.user.create({
          data: {
            email: profile.email,
            googleId: profile.sub,
            name: profile.name?.slice(0, 80) || profile.email.split("@")[0],
            emailVerifiedAt: new Date(),
          },
        });
      }
    }

    const { sessionToken, maxAge } = await createSession(user.id, saved.rememberMe !== false, req);
    const res = NextResponse.redirect(new URL("/", appUrl(req)));
    setSessionCookie(res, sessionToken, maxAge);
    res.cookies.set({ name: GOOGLE_STATE_COOKIE, value: "", path: "/api/auth/google", maxAge: 0 });
    return res;
  } catch (error) {
    console.error("Google sign-in error:", error);
    return fail(req, "google_failed");
  }
}
