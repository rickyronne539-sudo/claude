import { NextResponse } from "next/server";
import { findCourse, fulfillPayment } from "@/lib/enrollment";
import { isPaymentPurpose, verifyWebhookSignature } from "@/lib/stripe";

// Stripe → this server. Set STRIPE_WEBHOOK_SECRET and subscribe to "checkout.session.completed"
// (and "checkout.session.async_payment_succeeded" if you allow delayed payment methods).
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret.startsWith("whsec_") || secret.includes("sample")) {
    console.error("[Stripe webhook] STRIPE_WEBHOOK_SECRET is not set; ignoring event.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const rawBody = await req.text();
  if (!verifyWebhookSignature(rawBody, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const type = event.type;
  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    const session = event.data?.object as {
      id: string; payment_status?: string; amount_total?: number; currency?: string;
      metadata?: Record<string, string>;
    };
    const { userId, courseId, purpose } = session?.metadata || {};

    if (session?.payment_status === "paid" && userId && findCourse(courseId) && isPaymentPurpose(purpose)) {
      try {
        await fulfillPayment({
          userId,
          courseId: courseId!,
          purpose,
          stripeSessionId: session.id,
          amountCents: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
        });
      } catch (error) {
        console.error("[Stripe webhook] fulfilment failed", session.id, error);
        // 500 makes Stripe retry later.
        return NextResponse.json({ error: "Fulfilment failed." }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
