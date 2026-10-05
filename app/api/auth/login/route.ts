import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPassword, clientIp, createSession, DB_UNAVAILABLE, setSessionCookie } from "@/lib/auth";
import { clearAttempts, LIMITS, recordAttempt, retryAfterMinutes, tooMany } from "@/lib/rate-limit";
import { publicEnrollment } from "@/lib/enrollment";

// Same message for "no such email" and "wrong password", and the same timing, so the form
// can't be used to find out who has an account.
const BAD_LOGIN = { error: "That email and password don't match an account." };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password, rememberMe } = body as { email?: unknown; password?: unknown; rememberMe?: unknown };

  if (typeof email !== "string" || typeof password !== "string" || !email || !password || password.length > 200) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase().slice(0, 254);

  try {
    const ip = clientIp(req);
    const limits = [LIMITS.loginEmail(normalizedEmail), LIMITS.loginIp(ip)];
    const wait = await retryAfterMinutes(limits);
    if (wait) return NextResponse.json(tooMany(wait), { status: 429 });

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { enrollments: true },
    });

    if (!(await checkPassword(password, user?.passwordHash))) {
      await recordAttempt(...limits.map((l) => l.key));
      return NextResponse.json(BAD_LOGIN, { status: 401 });
    }

    await clearAttempts(LIMITS.loginEmail(normalizedEmail).key);
    const { sessionToken, maxAge } = await createSession(user!.id, Boolean(rememberMe), req);
    const res = NextResponse.json({
      success: true,
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        enrollments: user!.enrollments.map(publicEnrollment),
      },
    });
    setSessionCookie(res, sessionToken, maxAge);
    return res;
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(DB_UNAVAILABLE, { status: 503 });
  }
}
