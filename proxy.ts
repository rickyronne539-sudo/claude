import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Runs before every page and API request (Next.js 16 "proxy", formerly middleware).
//
// 1. Blocks cross-site requests that change data (CSRF): a POST to /api/* must come from
//    this site. Stripe's webhook is exempt; it's verified by its signature instead.
// 2. Adds standard security headers.

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_EXEMPT = ["/api/stripe/webhook"];

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!origin) return false;
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/") &&
    UNSAFE.has(req.method) &&
    !CSRF_EXEMPT.some((p) => pathname.startsWith(p)) &&
    !sameOrigin(req)
  ) {
    return NextResponse.json({ error: "Request blocked: it didn't come from this site." }, { status: 403 });
  }

  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
