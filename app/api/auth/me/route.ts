import { NextRequest, NextResponse } from "next/server";
import { publicUser, userFromRequest } from "@/lib/auth";
import { publicEnrollment } from "@/lib/enrollment";

export async function GET(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    if (!user) return NextResponse.json({ authenticated: false, user: null });
    return NextResponse.json({
      authenticated: true,
      user: { ...publicUser(user), enrollments: user.enrollments.map(publicEnrollment) },
    });
  } catch (error) {
    console.error("Auth me check error:", error);
    return NextResponse.json({ authenticated: false, user: null, error: "Service unavailable" }, { status: 503 });
  }
}
