"use client";

import { useState, useEffect, useRef } from "react";
import { CertificationCourseData } from "@/lib/courses-data";

// Graded on the server (/api/courses/exam); the answers are never sent to the browser
// until the learner passes.
export interface ExamResult {
  passed: boolean;
  correctCount: number;
  total: number;
  scorePercent: number;
  passMarkPercent: number;
  enrollment: Record<string, unknown> | null;
  review: { id: number; chosen: number | null; correct: boolean; correctIndex: number; explanation: string }[] | null;
}

export function CertificationExamModal({
  course,
  onPassExam,
  onClose,
}: {
  course: CertificationCourseData;
  onPassExam: (result: ExamResult) => void;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(900); // 15 mins
  // Latest answers, read when the timer runs out
  const answersRef = useRef<Record<number, number>>({});
  const score = result?.correctCount ?? 0;
  const passed = Boolean(result?.passed);

  // Countdown timer (the time-up submit is further down, after evaluateExam)
  useEffect(() => {
    if (isFinished) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isFinished]);

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  const currentQ = course.examQuestions[currentIndex];
  const totalQuestions = course.examQuestions.length;
  const currentAnswer = selectedAnswers[currentQ.id];

  function handleSelectOption(optIdx: number) {
    const next = { ...selectedAnswers, [currentQ.id]: optIdx };
    answersRef.current = next;
    setSelectedAnswers(next);
  }

  function handleNext() {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      evaluateExam();
    }
  }

  async function evaluateExam() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/courses/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, answers: answersRef.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error || "We couldn't submit your exam. Check your connection and try again.");
        return;
      }
      setResult(data as ExamResult);
      setIsFinished(true);
    } catch {
      setSubmitError("We couldn't submit your exam. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Time's up: submit whatever has been answered.
  const timeUp = secondsRemaining === 0 && !isFinished && !submitting;
  useEffect(() => {
    if (!timeUp) return;
    const t = setTimeout(() => { evaluateExam(); }, 0);
    return () => clearTimeout(t);
  }, [timeUp]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRetake() {
    answersRef.current = {};
    setSelectedAnswers({});
    setCurrentIndex(0);
    setResult(null);
    setSubmitError("");
    setIsFinished(false);
    setSecondsRemaining(900);
  }

  return (
    <div className="exam-overlay" role="dialog" aria-modal="true" aria-label="Certification Assessment">
      <div className="exam-card">
        {/* Header */}
        <div className="exam-header">
          <div>
            <span className="exam-title-badge">{course.level} CREDENTIAL ASSESSMENT</span>
            <h2 style={{ fontFamily: "Georgia, serif", margin: "4px 0 0", fontSize: "20px", color: "#1b2925" }}>
              {course.title}
            </h2>
          </div>
          {!isFinished && (
            <div className="exam-timer" title="Time remaining for this examination session">
              &#9201; {formatTime(secondsRemaining)}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: 0, fontSize: "16px", cursor: "pointer", color: "#788780" }}
            aria-label="Close exam"
          >
            ✕
          </button>
        </div>

        {/* ── EXAM IN PROGRESS ── */}
        {!isFinished ? (
          <div>
            {/* Progress bar */}
            <div className="exam-progress-bar">
              <div
                className="exam-progress-fill"
                style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
              />
            </div>

            <p style={{ fontSize: "11px", color: "#64776e", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
              QUESTION {currentIndex + 1} OF {totalQuestions}
            </p>

            <h3 className="exam-question-text">{currentQ.question}</h3>

            <div className="exam-options-grid">
              {currentQ.options.map((option, idx) => (
                <label
                  key={idx}
                  className={`exam-option-item ${currentAnswer === idx ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name={`exam-q-${currentQ.id}`}
                    checked={currentAnswer === idx}
                    onChange={() => handleSelectOption(idx)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px" }}>
              <button
                type="button"
                className="classroom-nav-action-btn"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => prev - 1)}
              >
                ← Previous
              </button>

              <button
                type="button"
                className="continue-button"
                style={{ margin: 0 }}
                disabled={currentAnswer === undefined || submitting}
                onClick={handleNext}
              >
                {currentIndex === totalQuestions - 1 ? (submitting ? "Grading…" : "Submit Final Exam →") : "Next Question →"}
              </button>
            </div>
            {submitError && (
              <p role="alert" style={{ color: "#c5221f", fontSize: "13px", marginTop: "12px" }}>{submitError}</p>
            )}
          </div>
        ) : (
          /* ── EXAM RESULTS ── */
          <div className="exam-result-wrap">
            <div className={`exam-score-dial ${passed ? "passed" : "failed"}`}>
              {Math.round((score / totalQuestions) * 100)}%
              <small>{score}/{totalQuestions} correct</small>
            </div>

            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "28px", margin: "0 0 10px", color: "#1b2925" }}>
              {passed ? "Examination Passed!" : "Assessment Not Yet Passed"}
            </h2>

            <p style={{ color: "#54645c", fontSize: "14px", lineHeight: 1.6, maxWidth: "520px", margin: "0 auto 24px" }}>
              {passed
                ? `Well done. You met the ${result?.passMarkPercent ?? 80}% pass mark for ${course.title}. Your certificate is ready.`
                : `You scored ${score} out of ${totalQuestions} (${result?.scorePercent ?? 0}%). You need ${result?.passMarkPercent ?? 80}% to pass. Review the lessons and try again when you're ready.`}
            </p>

            {/* Question by question review — only after passing */}
            {passed && result?.review && (
            <div style={{ textAlign: "left", margin: "24px 0", background: "#f8faf8", padding: "16px 20px", borderRadius: "4px", border: "1px solid #d9e3dc" }}>
              <h4 style={{ fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: "#4e8064", margin: "0 0 14px" }}>
                EXAMINATION REVIEW
              </h4>
              {course.examQuestions.map((q, qIdx) => {
                const r = result.review!.find((x) => x.id === q.id);
                const isCorrect = Boolean(r?.correct);
                return (
                  <div key={q.id} style={{ marginBottom: "14px", paddingBottom: "14px", borderBottom: "1px solid #e5ebe7" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "baseline", marginBottom: "4px" }}>
                      <span style={{ fontWeight: "bold", color: isCorrect ? "#137333" : "#c5221f" }}>
                        {isCorrect ? "✓ Q" + (qIdx + 1) : "✕ Q" + (qIdx + 1)}
                      </span>
                      <strong style={{ fontSize: "13px", color: "#1b2925" }}>{q.question}</strong>
                    </div>
                    {r && (
                      <>
                        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#596860" }}>
                          <strong>Correct Answer:</strong> {q.options[r.correctIndex]}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#74867d" }}>
                          <em>{r.explanation}</em>
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              {passed ? (
                <button
                  type="button"
                  className="continue-button"
                  style={{ fontSize: "14px", padding: "14px 28px" }}
                  onClick={() => result && onPassExam(result)}
                >
                  View Certificate →
                </button>
              ) : (
                <button
                  type="button"
                  className="continue-button"
                  style={{ fontSize: "14px", padding: "14px 28px" }}
                  onClick={handleRetake}
                >
                  Retake Examination ⟳
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
