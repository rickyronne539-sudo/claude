import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, createSession, DB_UNAVAILABLE, hashPassword, setSessionCookie } from "@/lib/auth";
import { passwordProblem } from "@/lib/passwords";
import { LIMITS, recordAttempt, retryAfterMinutes, tooMany } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password, name, rememberMe } = body as {
    email?: unknown; password?: unknown; name?: unknown; rememberMe?: unknown;
  };

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(normalizedEmail) || normalizedEmail.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const problem = passwordProblem(password, normalizedEmail);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    const ip = clientIp(req);
    const wait = await retryAfterMinutes([LIMITS.registerIp(ip)]);
    if (wait) return NextResponse.json(tooMany(wait), { status: 429 });
    await recordAttempt(LIMITS.registerIp(ip).key);

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in, or use “Forgot password”." },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: await hashPassword(password as string),
        passwordChangedAt: new Date(),
        name: (typeof name === "string" && name.trim().slice(0, 80)) || normalizedEmail.split("@")[0],
      },
      select: { id: true, email: true, name: true },
    });

    const { sessionToken, maxAge } = await createSession(user.id, Boolean(rememberMe), req);
    const res = NextResponse.json({ success: true, user });
    setSessionCookie(res, sessionToken, maxAge);
    return res;
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    console.error("Register API error:", error);
    return NextResponse.json(DB_UNAVAILABLE, { status: 503 });
  }
}
