import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { userFromRequest, DB_UNAVAILABLE } from "@/lib/auth";
import { findCourse, fulfillPayment, publicEnrollment } from "@/lib/enrollment";
import {
  COURSE_PRICING,
  createCheckoutSession,
  isPaymentPurpose,
  paymentSimulationAllowed,
  stripeConfigured,
} from "@/lib/stripe";

// POST { courseId, purpose } — start a payment. Returns a Stripe Checkout URL to redirect to.
// In development without Stripe keys, the payment is simulated instead.
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await userFromRequest(req);
  } catch {
    return NextResponse.json(DB_UNAVAILABLE, { status: 503 });
  }
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const { courseId, purpose } = (await req.json().catch(() => ({}))) as { courseId?: string; purpose?: string };
  const course = findCourse(courseId);
  if (!course) return NextResponse.json({ error: "Unknown course." }, { status: 400 });
  if (!isPaymentPurpose(purpose)) return NextResponse.json({ error: "Unknown payment type." }, { status: 400 });

  // Only charge for what's actually due next.
  const e = user.enrollments.find((x) => x.courseId === course.id);
  if (purpose === "deposit" && e?.isDepositPaid) {
    return NextResponse.json({ error: "The deposit for this course is already paid." }, { status: 409 });
  }
  if (purpose === "full" && (e?.isDepositPaid || e?.isExamPaid)) {
    return NextResponse.json({ error: "Part of this course is already paid. Pay the remaining balance instead." }, { status: 409 });
  }
  if (purpose === "exam_balance") {
    if (!e?.isDepositPaid) return NextResponse.json({ error: "Pay the enrollment deposit first." }, { status: 409 });
    if (e.isExamPaid) return NextResponse.json({ error: "The exam balance is already paid." }, { status: 409 });
    const allDone = course.lessons.every((l) => e.completedLessons.includes(l.id));
    if (!allDone) return NextResponse.json({ error: "Finish all lessons before paying for the exam." }, { status: 409 });
  }

  const pricing = COURSE_PRICING[purpose];

  if (!stripeConfigured()) {
    if (!paymentSimulationAllowed()) {
      return NextResponse.json({ error: "Payments are not set up yet. Please try again later." }, { status: 503 });
    }
    // Development only: pretend Stripe confirmed the payment.
    const enrollment = await fulfillPayment({
      userId: user.id,
      courseId: course.id,
      purpose,
      stripeSessionId: `sim_${crypto.randomBytes(12).toString("hex")}`,
      amountCents: pricing.amountCents,
    });
    return NextResponse.json({ simulated: true, enrollment: publicEnrollment(enrollment) });
  }

  try {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, "");
    const session = await createCheckoutSession({
      purpose,
      courseId: course.id,
      courseTitle: course.title,
      userId: user.id,
      userEmail: user.email,
      appUrl,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "We couldn't start the payment. Please try again." }, { status: 502 });
  }
}
