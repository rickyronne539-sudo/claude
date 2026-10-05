"use client";

import { Lesson, CertificationCourseData } from "@/lib/courses-data";

export function LessonPreviewModal({
  course,
  lesson,
  onUnlockWithDeposit,
  onClose,
}: {
  course: CertificationCourseData;
  lesson: Lesson;
  onUnlockWithDeposit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Lesson Preview">
      <div className="preview-modal-card">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close preview">
          ✕
        </button>

        <div className="preview-lock-icon">&#128274;</div>

        <p className="dashboard-kicker">STAGE 1 ENROLLMENT REQUIRED</p>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#1b2925", margin: "0 0 10px" }}>
          {lesson.title}
        </h2>
        <p style={{ color: "#5a6b63", fontSize: "13px", lineHeight: 1.6, margin: "0 0 18px" }}>
          {lesson.summary}
        </p>

        <div style={{ background: "#f5f7f5", padding: "14px 18px", borderRadius: "3px", border: "1px solid #dfe5e1", marginBottom: "20px" }}>
          <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#4e8064", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "6px" }}>
            WHAT YOU WILL LEARN IN THIS LESSON ({lesson.estimatedTime})
          </span>
          <ul style={{ margin: 0, paddingLeft: "16px", color: "#32443c", fontSize: "12px", lineHeight: 1.6 }}>
            {lesson.objectives.map((obj, i) => (
              <li key={i}>{obj}</li>
            ))}
          </ul>
        </div>

        <div style={{ background: "#fbf9f5", border: "1px solid #e7ded2", padding: "14px", borderRadius: "4px", marginBottom: "20px", fontSize: "12px", color: "#615042" }}>
          <strong>Two-Stage Flexible Tuition:</strong> Pay only the <strong>{course.depositPrice} enrollment deposit</strong> today to unlock all {course.lessons.length} interactive lessons, the simulated prompt sandbox, and hands-on coding labs. The remaining balance ({course.examPrice}) is only due when taking the final exam.
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            className="continue-button"
            style={{ flex: 1, padding: "14px 20px" }}
            onClick={() => {
              onClose();
              onUnlockWithDeposit();
            }}
          >
            Pay {course.depositPrice} Deposit to Unlock All Lessons →
          </button>
          <button
            type="button"
            className="modal-cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
