import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appUrl, clientIp, DB_UNAVAILABLE, hashToken, randomToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/mail";
import { LIMITS, recordAttempt, retryAfterMinutes, tooMany } from "@/lib/rate-limit";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

// Always gives the same answer, so this can't be used to check which emails have accounts.
const GENERIC = { success: true, message: "If an account exists for that email, we've sent a link to reset the password." };

export async function POST(req: NextRequest) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: unknown };
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase().slice(0, 254) : "";
  if (!normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "Enter the email you signed up with." }, { status: 400 });
  }

  try {
    const ip = clientIp(req);
    const limits = [LIMITS.resetEmail(normalizedEmail), LIMITS.resetIp(ip)];
    const wait = await retryAfterMinutes(limits);
    if (wait) return NextResponse.json(tooMany(wait), { status: 429 });
    await recordAttempt(...limits.map((l) => l.key));

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (user) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      const token = randomToken();
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
      });
      try {
        await sendPasswordResetEmail(user.email, `${appUrl(req)}/reset-password?token=${token}`);
      } catch (mailError) {
        console.error("Password reset email failed:", mailError);
      }
    }
    return NextResponse.json(GENERIC);
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(DB_UNAVAILABLE, { status: 503 });
  }
}
