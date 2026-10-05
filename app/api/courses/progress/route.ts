import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { userFromRequest, DB_UNAVAILABLE } from "@/lib/auth";
import { findCourse, publicEnrollment } from "@/lib/enrollment";

// GET — the signed-in learner's enrollments (payment, lessons, exam, certificate).
export async function GET(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ enrollments: user.enrollments.map(publicEnrollment) });
  } catch (error) {
    console.error("Fetch progress error:", error);
    return NextResponse.json(DB_UNAVAILABLE, { status: 503 });
  }
}

// POST { courseId, lessonId } — mark one lesson complete.
// Payment, exam and certificate status are set only by the server (checkout and exam routes).
export async function POST(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { courseId, lessonId } = (await req.json().catch(() => ({}))) as { courseId?: string; lessonId?: string };
    const course = findCourse(courseId);
    if (!course) return NextResponse.json({ error: "Unknown course." }, { status: 400 });
    if (!course.lessons.some((l) => l.id === lessonId)) {
      return NextResponse.json({ error: "Unknown lesson." }, { status: 400 });
    }

    const enrollment = user.enrollments.find((e) => e.courseId === course.id);
    if (!enrollment?.isDepositPaid) {
      return NextResponse.json({ error: "Pay the enrollment deposit to unlock lessons." }, { status: 402 });
    }

    const updated = enrollment.completedLessons.includes(lessonId!)
      ? enrollment
      : await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { completedLessons: { push: lessonId! } },
        });

    return NextResponse.json({ success: true, enrollment: publicEnrollment(updated) });
  } catch (error) {
    console.error("Save progress error:", error);
    return NextResponse.json(DB_UNAVAILABLE, { status: 503 });
  }
}
