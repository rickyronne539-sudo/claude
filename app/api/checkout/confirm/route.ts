import { NextRequest, NextResponse } from "next/server";
import { userFromRequest, DB_UNAVAILABLE } from "@/lib/auth";
import { findCourse, fulfillPayment, publicEnrollment } from "@/lib/enrollment";
import { isPaymentPurpose, retrieveCheckoutSession, stripeConfigured } from "@/lib/stripe";

// GET ?session_id=cs_... — called when the learner comes back from Stripe Checkout.
// Asks Stripe whether the session was paid (the URL alone proves nothing) and unlocks the course.
// The webhook does the same thing in case the learner closes the tab before returning.
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await userFromRequest(req);
  } catch {
    return NextResponse.json(DB_UNAVAILABLE, { status: 503 });
  }
  if (!user) return NextResponse.json({ error: "Please sign in again to finish your payment." }, { status: 401 });
  if (!stripeConfigured()) return NextResponse.json({ error: "Payments are not set up." }, { status: 503 });

  const sessionId = req.nextUrl.searchParams.get("session_id") || "";
  try {
    const session = await retrieveCheckoutSession(sessionId);
    const { userId, courseId, purpose } = session.metadata || {};

    if (userId !== user.id) {
      return NextResponse.json({ error: "This payment belongs to a different account." }, { status: 403 });
    }
    if (session.payment_status !== "paid") {
      return NextResponse.json({ paid: false, message: "Stripe hasn't confirmed this payment yet." }, { status: 202 });
    }
    const course = findCourse(courseId);
    if (!course || !isPaymentPurpose(purpose)) {
      return NextResponse.json({ error: "This payment isn't linked to a course." }, { status: 400 });
    }

    const enrollment = await fulfillPayment({
      userId: user.id,
      courseId: course.id,
      purpose,
      stripeSessionId: session.id,
      amountCents: session.amount_total ?? 0,
      currency: session.currency ?? "usd",
    });
    return NextResponse.json({ paid: true, purpose, courseId: course.id, enrollment: publicEnrollment(enrollment) });
  } catch (error) {
    console.error("Checkout confirm error:", error);
    return NextResponse.json({ error: "We couldn't confirm the payment with Stripe. Refresh the page in a moment." }, { status: 502 });
  }
}
