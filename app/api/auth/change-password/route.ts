import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPassword, DB_UNAVAILABLE, hashPassword, revokeSessions, userFromRequest } from "@/lib/auth";
import { passwordProblem } from "@/lib/passwords";
import { clearAttempts, LIMITS, recordAttempt, retryAfterMinutes, tooMany } from "@/lib/rate-limit";

// POST { currentPassword?, newPassword } — change (or, for Google-only accounts, add) a password.
// Other devices are signed out; this one stays signed in.
export async function POST(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const { currentPassword, newPassword } = (await req.json().catch(() => ({}))) as {
      currentPassword?: unknown; newPassword?: unknown;
    };

    const limit = LIMITS.changePassword(user.id);
    const wait = await retryAfterMinutes([limit]);
    if (wait) return NextResponse.json(tooMany(wait), { status: 429 });

    const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (record?.passwordHash) {
      if (typeof currentPassword !== "string" || !(await checkPassword(currentPassword, record.passwordHash))) {
        await recordAttempt(limit.key);
        return NextResponse.json({ error: "Your current password is wrong." }, { status: 400 });
      }
      if (currentPassword === newPassword) {
        return NextResponse.json({ error: "Choose a password different from your current one." }, { status: 400 });
      }
    }

    const problem = passwordProblem(newPassword, user.email);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword as string), passwordChangedAt: new Date() },
    });
    await revokeSessions(user.id, user.sessionId);
    await clearAttempts(limit.key);

    return NextResponse.json({
      success: true,
      message: record?.passwordHash ? "Password changed. Other devices have been signed out." : "Password added. You can now sign in with your email too.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(DB_UNAVAILABLE, { status: 503 });
  }
}
