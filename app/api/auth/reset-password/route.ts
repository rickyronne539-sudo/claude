import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DB_UNAVAILABLE, hashPassword, hashToken, revokeSessions } from "@/lib/auth";
import { passwordProblem } from "@/lib/passwords";

const INVALID = { error: "This reset link is invalid or has expired. Request a new one." };

async function findToken(token: unknown) {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return null;
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

// GET ?token= — lets the reset page check the link before showing the form.
export async function GET(req: NextRequest) {
  try {
    const row = await findToken(req.nextUrl.searchParams.get("token"));
    if (!row) return NextResponse.json(INVALID, { status: 410 });
    return NextResponse.json({ valid: true, email: row.user.email });
  } catch {
    return NextResponse.json(DB_UNAVAILABLE, { status: 503 });
  }
}

// POST { token, password } — set the new password and sign out every device.
export async function POST(req: NextRequest) {
  const { token, password } = (await req.json().catch(() => ({}))) as { token?: unknown; password?: unknown };
  try {
    const row = await findToken(token);
    if (!row) return NextResponse.json(INVALID, { status: 410 });

    const problem = passwordProblem(password, row.user.email);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    // Use the token exactly once, even if two requests arrive together.
    const claimed = await prisma.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) return NextResponse.json(INVALID, { status: 410 });

    await prisma.user.update({
      where: { id: row.userId },
      data: {
        passwordHash: await hashPassword(password as string),
        passwordChangedAt: new Date(),
        emailVerifiedAt: new Date(), // opening the emailed link proves they own the address
      },
    });
    await revokeSessions(row.userId);
    await prisma.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null } });

    return NextResponse.json({ success: true, message: "Password changed. Sign in with your new password." });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(DB_UNAVAILABLE, { status: 503 });
  }
}
