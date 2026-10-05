import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { userFromRequest, DB_UNAVAILABLE } from "@/lib/auth";
import { findCourse, newCredentialId, publicEnrollment } from "@/lib/enrollment";
import { EXAM_KEYS, PASS_MARK } from "@/lib/exam-keys";

// POST { courseId, answers: { [questionId]: optionIndex } } — grade the final exam on the server.
// On a pass the learner is certified and gets the full answer review. On a fail only the score
// is returned, so repeated attempts can't be used to work out the answers.
export async function POST(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { courseId?: string; answers?: Record<string, unknown> };
    const course = findCourse(body.courseId);
    const key = course ? EXAM_KEYS[course.id] : null;
    if (!course || !key) return NextResponse.json({ error: "Unknown course." }, { status: 400 });

    const enrollment = user.enrollments.find((e) => e.courseId === course.id);
    if (!enrollment?.isExamPaid) {
      return NextResponse.json({ error: "Pay the exam balance to take the exam." }, { status: 402 });
    }
    if (!course.lessons.every((l) => enrollment.completedLessons.includes(l.id))) {
      return NextResponse.json({ error: "Finish all lessons before taking the exam." }, { status: 409 });
    }
    if (enrollment.isCertified) {
      return NextResponse.json({ error: "You've already passed this exam.", enrollment: publicEnrollment(enrollment) }, { status: 409 });
    }

    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
    const questionIds = Object.keys(key).map(Number);
    const results = questionIds.map((id) => {
      const chosen = Number(answers[String(id)]);
      return { id, chosen: Number.isInteger(chosen) ? chosen : null, correct: chosen === key[id].correctIndex };
    });
    const correctCount = results.filter((r) => r.correct).length;
    const total = questionIds.length;
    const scorePercent = Math.round((correctCount / total) * 100);
    const passed = correctCount >= Math.ceil(total * PASS_MARK);

    const updated = await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        examAttempts: { increment: 1 },
        examScore: Math.max(scorePercent, enrollment.examScore ?? 0),
        ...(passed && { isCertified: true, credentialId: newCredentialId(), certifiedAt: new Date() }),
      },
    });

    return NextResponse.json({
      passed,
      correctCount,
      total,
      scorePercent,
      passMarkPercent: Math.round(PASS_MARK * 100),
      enrollment: publicEnrollment(updated),
      // Full review only after passing
      review: passed
        ? results.map((r) => ({ ...r, correctIndex: key[r.id].correctIndex, explanation: key[r.id].explanation }))
        : null,
    });
  } catch (error) {
    console.error("Exam grading error:", error);
    return NextResponse.json(DB_UNAVAILABLE, { status: 503 });
  }
}
