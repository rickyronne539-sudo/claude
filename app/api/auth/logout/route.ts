import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, deleteSession, revokeSessions, SESSION_COOKIE_NAME, userFromRequest } from "@/lib/auth";

// POST            — sign out on this device
// POST ?all=1     — sign out on every device
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const everywhere = req.nextUrl.searchParams.get("all") === "1";
  try {
    if (token) {
      if (everywhere) {
        const user = await userFromRequest(req);
        if (user) await revokeSessions(user.id);
      }
      await deleteSession(token);
    }
  } catch (error) {
    console.error("Logout API error:", error);
    // Still clear the cookie below so this browser is signed out.
  }
  const res = NextResponse.json({ success: true });
  clearSessionCookie(res);
  return res;
}
