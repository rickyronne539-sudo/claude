// Stripe via its REST API (no SDK). Payments use Stripe Checkout: the learner pays on
// Stripe's own page, so card details never reach this server.
import crypto from "crypto";

export const STRIPE_API_BASE = "https://api.stripe.com/v1";

export const COURSE_PRICING = {
  deposit: {
    amountCents: 1500,
    amountFormatted: "$15.00",
    label: "Course Enrollment Deposit",
    description: "Stage 1: Access to all certification lessons and progress tracking.",
  },
  exam_balance: {
    amountCents: 3500,
    amountFormatted: "$35.00",
    label: "Final Exam & Certificate Balance",
    description: "Stage 2: Unlocks the final assessment and certificate.",
  },
  full: {
    amountCents: 5000,
    amountFormatted: "$50.00",
    label: "Full Course Package",
    description: "Complete course tuition (Deposit + Final Exam).",
  },
} as const;

export type PaymentPurpose = keyof typeof COURSE_PRICING;

export const isPaymentPurpose = (v: unknown): v is PaymentPurpose =>
  typeof v === "string" && v in COURSE_PRICING;

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  return key.startsWith("sk_") && !key.includes("sample") ? key : "";
}

/** True when real Stripe keys are set. */
export const stripeConfigured = () => Boolean(secretKey());

/**
 * Without Stripe keys, development can simulate payments so the course flow can be tested.
 * Never allowed in production.
 */
export const paymentSimulationAllowed = () =>
  !stripeConfigured() && process.env.NODE_ENV !== "production";

async function stripeRequest(path: string, init: { method: "GET" | "POST"; body?: URLSearchParams }) {
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(init.body && { "Content-Type": "application/x-www-form-urlencoded" }),
    },
    body: init.body?.toString(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Stripe request failed (${res.status})`);
  return data;
}

export async function createCheckoutSession(opts: {
  purpose: PaymentPurpose;
  courseId: string;
  courseTitle: string;
  userId: string;
  userEmail: string;
  appUrl: string;
}) {
  const pricing = COURSE_PRICING[opts.purpose];
  const p = new URLSearchParams();
  p.append("mode", "payment");
  p.append("line_items[0][quantity]", "1");
  p.append("line_items[0][price_data][currency]", "usd");
  p.append("line_items[0][price_data][unit_amount]", String(pricing.amountCents));
  p.append("line_items[0][price_data][product_data][name]", `${pricing.label}: ${opts.courseTitle}`);
  p.append("line_items[0][price_data][product_data][description]", pricing.description);
  p.append("customer_email", opts.userEmail);
  p.append("client_reference_id", opts.userId);
  for (const [k, v] of Object.entries({ userId: opts.userId, courseId: opts.courseId, purpose: opts.purpose })) {
    p.append(`metadata[${k}]`, v);
    p.append(`payment_intent_data[metadata][${k}]`, v);
  }
  p.append("success_url", `${opts.appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  p.append("cancel_url", `${opts.appUrl}/?checkout=cancelled&course=${encodeURIComponent(opts.courseId)}`);

  const session = await stripeRequest("/checkout/sessions", { method: "POST", body: p });
  return { id: session.id as string, url: session.url as string };
}

export type CheckoutSession = {
  id: string;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, string>;
};

export async function retrieveCheckoutSession(id: string): Promise<CheckoutSession> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) throw new Error("Invalid checkout session id.");
  return stripeRequest(`/checkout/sessions/${id}`, { method: "GET" });
}

/**
 * Checks the Stripe-Signature header (HMAC-SHA256 of "<timestamp>.<raw body>").
 * Returns false for bad signatures or events older than 5 minutes.
 */
export function verifyWebhookSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = header.split(",").map((kv) => kv.split("=") as [string, string]);
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSec) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  return signatures.some((sig) => {
    const buf = Buffer.from(sig, "hex");
    return buf.length === expectedBuf.length && crypto.timingSafeEqual(buf, expectedBuf);
  });
}
