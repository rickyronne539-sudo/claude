import { NextResponse } from "next/server";
import { googleConfigured } from "@/lib/google";

// Which sign-in options the login page should show.
export async function GET() {
  return NextResponse.json({ google: googleConfigured() });
}
