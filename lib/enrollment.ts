// Server-side rules for what a learner has unlocked. The browser never sets these directly.
import crypto from "crypto";
import { prisma } from "./prisma";
import { ALL_COURSES } from "./courses-data";
import type { PaymentPurpose } from "./stripe";

export function findCourse(courseId: unknown) {
  return typeof courseId === "string" ? ALL_COURSES.find((c) => c.id === courseId) ?? null : null;
}

export async function getEnrollment(userId: string, courseId: string) {
  return prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
}

/** Fields safe to send to the browser. */
export function publicEnrollment(e: {
  courseId: string; courseTitle: string; isDepositPaid: boolean; isExamPaid: boolean; isCertified: boolean;
  completedLessons: string[]; examScore: number | null; examAttempts?: number; credentialId: string | null;
  certifiedAt?: Date | null;
} | null) {
  if (!e) return null;
  return {
    courseId: e.courseId,
    courseTitle: e.courseTitle,
    isDepositPaid: e.isDepositPaid,
    isExamPaid: e.isExamPaid,
    isCertified: e.isCertified,
    completedLessons: e.completedLessons,
    examScore: e.examScore,
    examAttempts: e.examAttempts ?? 0,
    credentialId: e.credentialId,
    certifiedAt: e.certifiedAt ?? null,
  };
}

/**
 * Records a confirmed payment and unlocks what it paid for. Safe to call more than once
 * for the same Stripe session (the redirect back and the webhook both call it).
 */
export async function fulfillPayment(opts: {
  userId: string;
  courseId: string;
  purpose: PaymentPurpose;
  stripeSessionId: string;
  amountCents: number;
  currency?: string;
}) {
  const course = findCourse(opts.courseId);
  if (!course) throw new Error(`Unknown course ${opts.courseId}`);

  const already = await prisma.payment.findUnique({ where: { stripeSessionId: opts.stripeSessionId } });
  if (!already) {
    try {
      await prisma.payment.create({
        data: {
          userId: opts.userId,
          courseId: opts.courseId,
          purpose: opts.purpose,
          stripeSessionId: opts.stripeSessionId,
          amountCents: opts.amountCents,
          currency: opts.currency || "usd",
        },
      });
    } catch (e: unknown) {
      // Another request recorded it at the same moment; that's fine.
      if ((e as { code?: string })?.code !== "P2002") throw e;
    }
  }

  const unlock = {
    ...(opts.purpose !== "exam_balance" && { isDepositPaid: true }),
    ...(opts.purpose !== "deposit" && { isExamPaid: true }),
  };
  return prisma.enrollment.upsert({
    where: { userId_courseId: { userId: opts.userId, courseId: opts.courseId } },
    create: { userId: opts.userId, courseId: opts.courseId, courseTitle: course.title, ...unlock },
    update: unlock,
  });
}

/** e.g. CA-7K2Q-M9XD — random so certificates can't be guessed. */
export function newCredentialId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => Array.from(crypto.randomBytes(4), (b) => alphabet[b % alphabet.length]).join("");
  return `CA-${pick()}-${pick()}`;
}
