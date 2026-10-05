import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/auth";
import { GOOGLE_STATE_COOKIE, googleAuthRequest, googleConfigured } from "@/lib/google";

// GET ?remember=1 — start "Continue with Google".
export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/?auth_error=google_unavailable", req.url));
  }
  const remember = req.nextUrl.searchParams.get("remember") !== "0";
  const { url, cookieValue } = googleAuthRequest(appUrl(req), remember);

  const res = NextResponse.redirect(url);
  res.cookies.set({
    name: GOOGLE_STATE_COOKIE,
    value: cookieValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // must survive the redirect back from Google
    path: "/api/auth/google",
    maxAge: 10 * 60,
  });
  return res;
}
