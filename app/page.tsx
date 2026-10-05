"use client";

import { useEffect, useState } from "react";
import { ALL_COURSES, CertificationCourseData, Lesson } from "@/lib/courses-data";
import { ClassroomModal } from "@/app/components/ClassroomModal";
import { CertificationExamModal, ExamResult } from "@/app/components/CertificationExamModal";
import { LessonPreviewModal } from "@/app/components/LessonPreviewModal";
import { AccountMenu } from "@/app/components/AccountMenu";

export interface Certification {
  id: string;
  level: string;
  title: string;
  description: string;
  duration: string;
  totalPrice: string;
  depositPrice: string;
  examPrice: string;
  tone: string;
}

const certifications: Certification[] = ALL_COURSES.map((c) => ({
  id: c.id,
  level: c.level,
  title: c.title,
  description: c.description,
  duration: c.duration,
  totalPrice: c.totalPrice,
  depositPrice: c.depositPrice,
  examPrice: c.examPrice,
  tone: c.tone,
}));

const DISCLAIMER =
  "Claude Academy is an independent training provider. It is not affiliated with, endorsed by, or sponsored by Anthropic. Claude is a trademark of Anthropic.";

// Server-side enrollment state (see lib/enrollment.ts publicEnrollment)
export interface EnrollmentState {
  courseId: string;
  isDepositPaid: boolean;
  isExamPaid: boolean;
  isCertified: boolean;
  completedLessons: string[];
  examScore: number | null;
  examAttempts: number;
  credentialId: string | null;
  certifiedAt: string | null;
}

// Payment happens on Stripe's own Checkout page, so card details never touch this site.
function PaymentModal({
  certification,
  purpose,
  onClose,
  onSimulatedPayment,
}: {
  certification: Certification;
  purpose: "deposit" | "exam_balance";
  onClose: () => void;
  onSimulatedPayment: (enrollment: EnrollmentState) => void;
}) {
  const [status, setStatus] = useState<"idle" | "redirecting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const isDeposit = purpose === "deposit";
  const currentAmount = isDeposit ? certification.depositPrice : certification.examPrice;

  async function startCheckout() {
    setStatus("redirecting");
    setErrorMessage("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: certification.id, purpose }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(data.error || "We couldn't start the payment. Please try again.");
        setStatus("error");
        return;
      }
      if (data.url) {
        window.location.href = data.url; // Stripe Checkout
        return;
      }
      if (data.simulated && data.enrollment) {
        // Development without Stripe keys
        onSimulatedPayment(data.enrollment);
        onClose();
        return;
      }
      setErrorMessage("Unexpected response from the payment server.");
      setStatus("error");
    } catch {
      setErrorMessage("You seem to be offline. Check your connection and try again.");
      setStatus("error");
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Checkout" onClick={status === "redirecting" ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {status !== "redirecting" && (
          <button className="modal-close" type="button" aria-label="Close checkout" onClick={onClose}>✕</button>
        )}

        <div className="modal-summary">
          <p className="dashboard-kicker">
            {isDeposit ? "STAGE 1 · COURSE ENROLLMENT DEPOSIT" : "STAGE 2 · FINAL EXAM & CERTIFICATE"}
          </p>
          <div className="modal-summary-row">
            <span>Course</span>
            <strong>{certification.title}</strong>
          </div>
          <div className="modal-summary-row">
            <span>Total Course Tuition</span>
            <span>{certification.totalPrice}</span>
          </div>
          {isDeposit ? (
            <>
              <div className="modal-summary-row">
                <span>Deposit Due Now (Unlocks Lessons)</span>
                <strong style={{ color: "#1b2925" }}>{certification.depositPrice}</strong>
              </div>
              <div className="modal-summary-row">
                <span>Remaining Balance (Due at Final Exam)</span>
                <span style={{ color: "#73847b" }}>{certification.examPrice}</span>
              </div>
            </>
          ) : (
            <div className="modal-summary-row">
              <span>Deposit Previously Paid</span>
              <span style={{ color: "#137333" }}>-{certification.depositPrice} ✓</span>
            </div>
          )}
          <div className="modal-summary-row modal-total">
            <span>Charge Today <small>(USD)</small></span>
            <strong>{currentAmount}</strong>
          </div>
        </div>

        {status === "error" && (
          <div className="error-box" role="alert">
            <span>{errorMessage}</span>
          </div>
        )}

        <button
          className="pay-button continue-button"
          type="button"
          style={{ width: "100%", marginTop: "12px" }}
          onClick={startCheckout}
          disabled={status === "redirecting"}
        >
          {status === "redirecting" ? "Opening secure checkout…" : `Pay ${currentAmount} securely`}
          {status !== "redirecting" && <span aria-hidden="true">&#8594;</span>}
        </button>

        <p className="payment-security">
          You&apos;ll pay on Stripe&apos;s secure checkout page and come straight back here. We never see your card details.
        </p>
      </div>
    </div>
  );
}

function CertificationCourse({
  certification,
  email,
  initialEnrollment,
  notice,
  onBack,
}: {
  certification: Certification;
  email: string;
  initialEnrollment?: EnrollmentState | null;
  notice?: string;
  onBack: () => void;
}) {
  // Start from what the server just returned (e.g. after Stripe checkout), then refresh below.
  const [completedLessons, setCompletedLessons] = useState<string[]>(() => initialEnrollment?.completedLessons ?? []);
  const [isDepositPaid, setIsDepositPaid] = useState(() => initialEnrollment?.isDepositPaid ?? false);
  const [isExamPaid, setIsExamPaid] = useState(() => initialEnrollment?.isExamPaid ?? false);
  const [isCertified, setIsCertified] = useState(() => initialEnrollment?.isCertified ?? false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);
  const [isExamOpen, setIsExamOpen] = useState(false);
  const [paymentModalState, setPaymentModalState] = useState<{
    isOpen: boolean;
    purpose: "deposit" | "exam_balance";
  }>({ isOpen: false, purpose: "deposit" });

  const courseData: CertificationCourseData =
    ALL_COURSES.find((c) => c.id === certification.id) || ALL_COURSES[0];
  const courseLessons = courseData.lessons;

  const progress = Math.min(100, Math.round((completedLessons.length / courseLessons.length) * 100));
  const [credential, setCredential] = useState<{ id: string | null; at: string | null; score: number | null }>(() => ({
    id: initialEnrollment?.credentialId ?? null,
    at: initialEnrollment?.certifiedAt ?? null,
    score: initialEnrollment?.examScore ?? null,
  }));
  const [courseError, setCourseError] = useState("");

  function applyEnrollment(e: EnrollmentState | null | undefined) {
    if (!e) return;
    setIsDepositPaid(e.isDepositPaid);
    setIsExamPaid(e.isExamPaid);
    setIsCertified(e.isCertified);
    setCompletedLessons(e.completedLessons || []);
    setCredential({ id: e.credentialId, at: e.certifiedAt, score: e.examScore });
  }

  // What's unlocked always comes from the server.
  useEffect(() => {
    fetch("/api/courses/progress")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => applyEnrollment(data?.enrollments?.find((e: EnrollmentState) => e?.courseId === courseData.id)))
      .catch(() => setCourseError("We couldn't load your progress. Refresh the page to try again."));
  }, [courseData.id]);

  async function toggleLesson(lessonId: string) {
    if (!isDepositPaid || completedLessons.includes(lessonId)) return;
    setCompletedLessons((current) => [...current, lessonId]); // show it straight away
    try {
      const res = await fetch("/api/courses/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: courseData.id, lessonId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) applyEnrollment(data.enrollment);
      else {
        setCompletedLessons((current) => current.filter((id) => id !== lessonId));
        setCourseError(data.error || "Your progress wasn't saved. Please try again.");
      }
    } catch {
      setCompletedLessons((current) => current.filter((id) => id !== lessonId));
      setCourseError("Your progress wasn't saved because you're offline.");
    }
  }

  function completeAssessment(result: ExamResult) {
    applyEnrollment(result.enrollment as unknown as EnrollmentState);
    setShowCertificate(true);
  }

  if (showCertificate) {
    return (
      <main className="certificate-shell">
        <div className="certificate-actions">
          <button className="back-button" type="button" onClick={() => setShowCertificate(false)}>
            &#8592; Back to course
          </button>
          <button className="continue-button" type="button" onClick={() => window.print()}>
            Print / save certificate
          </button>
        </div>
        <section className="certificate" aria-label={`${certification.title} certificate`}>
          <div className="certificate-border">
            <div className="brand-mark certificate-brand">
              <span className="brand-mark-icon">C</span>
              <span>Claude Academy</span>
            </div>
            <p className="certificate-kicker">CERTIFICATE OF COMPLETION</p>
            <h1>You did it.</h1>
            <p className="certificate-copy">This certifies that</p>
            <h2>{email}</h2>
            <p className="certificate-copy">has completed the coursework and passed the final assessment for</p>
            <h3>{courseData.title}</h3>
            
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "34px", flexWrap: "wrap" }}>
              <span className="stage-pill deposit-paid">{courseData.badge}</span>
              <span className="stage-pill exam-paid">Level: {courseData.level}</span>
              {credential.score != null && <span className="stage-pill deposit-paid">Score: {credential.score}%</span>}
            </div>

            <div className="certificate-footer">
              <span>Issued {new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(credential.at ? new Date(credential.at) : new Date())}</span>
              {credential.id && <span>Credential {credential.id}</span>}
            </div>
            <div className="certificate-seal" aria-hidden="true">
              C<span>CERTIFIED</span>
            </div>
            <p className="certificate-copy" style={{ fontSize: "10px", marginTop: "18px", opacity: 0.7 }}>{DISCLAIMER}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="course-shell">
        <header className="course-header">
          <button className="back-button" type="button" onClick={onBack}>
            &#8592; Back to overview
          </button>
          <div className="brand-mark course-logo">
            <span className="brand-mark-icon">C</span>
            <span>Claude Academy</span>
          </div>
          <span className="course-account">Your learning space</span>
        </header>

        <section className="course-body">
          <div className="course-intro">
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" }}>
              <p className="dashboard-kicker" style={{ margin: 0 }}>
                {courseData.level} CERTIFICATION
              </p>
              <span className="stage-pill deposit-paid" style={{ fontSize: "9px" }}>{courseData.badge}</span>
              {isDepositPaid && (
                <span className="stage-pill deposit-paid">✓ Enrolled (Deposit Paid)</span>
              )}
              {isExamPaid && (
                <span className="stage-pill exam-paid">✓ Exam Unlocked</span>
              )}
            </div>
            <h1>{courseData.title}</h1>
            <p>{courseData.description}</p>
            {notice && <p className="stage-pill deposit-paid" role="status" style={{ display: "inline-block", marginTop: "8px" }}>{notice}</p>}
            {courseError && <p role="alert" style={{ color: "#c5221f", fontSize: "13px", marginTop: "8px" }}>{courseError}</p>}
            <div className="course-meta">
              <span>&#9719; {courseData.duration}</span>
              <span>&#9638; {courseLessons.length} interactive lessons</span>
              <span>&#10003; 2-Stage Flexible Tuition</span>
              <span>&#127891; Target: {courseData.targetAudience}</span>
            </div>
          </div>

          {/* ── STAGE 1: ENROLLMENT DEPOSIT CARD ── */}
          {!isDepositPaid && (
            <section className="purchase-card">
              <div>
                <p className="dashboard-kicker">STAGE 1 · COURSE ENROLLMENT</p>
                <h2>Start with an enrollment deposit.</h2>
                <p>
                  Pay a <strong>{certification.depositPrice} deposit</strong> to access all {courseLessons.length} interactive lessons, the Claude prompt sandbox, and coding challenges immediately. You only pay the remaining balance ({certification.examPrice}) once you finish all lessons and are ready for the final exam.
                </p>
                <div className="deposit-pricing-breakdown">
                  <div>
                    <small>Step 1 (Today)</small>
                    <strong>{certification.depositPrice} Deposit</strong>
                  </div>
                  <div>
                    <small>Step 2 (At Exam)</small>
                    <strong>{certification.examPrice} Balance</strong>
                  </div>
                  <div>
                    <small>Total Course Tuition</small>
                    <strong>{certification.totalPrice}</strong>
                  </div>
                </div>
              </div>
              <div className="purchase-action">
                <strong>{certification.depositPrice} <span style={{ fontSize: "12px", color: "#6f9b87", fontWeight: 400 }}>deposit</span></strong>
                <button
                  className="continue-button"
                  type="button"
                  id="btn-unlock-course"
                  onClick={() => setPaymentModalState({ isOpen: true, purpose: "deposit" })}
                >
                  Pay Deposit with Stripe <span aria-hidden="true">&#8594;</span>
                </button>
                <small className="purchase-badges">
                  <span title="Visa">VISA</span>
                  <span title="Mastercard">MC</span>
                  <span title="American Express">AMEX</span>
                  <span title="Stripe">STRIPE</span>
                </small>
              </div>
            </section>
          )}

          {/* Progress bar */}
          <div className={`course-progress-card ${!isDepositPaid ? "locked" : ""}`}>
            <div className="course-progress-top">
              <span>Your progress</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-bar">
              <span style={{ width: `${progress}%` }} />
            </div>
            <p>
              {!isDepositPaid
                ? "Pay the enrollment deposit to unlock your interactive lessons and prompt lab."
                : completedLessons.length === 0
                ? "Click any lesson below to launch the Interactive Classroom."
                : `${completedLessons.length} of ${courseLessons.length} lessons complete`}
            </p>
          </div>

          {/* Lesson List */}
          <div className="lesson-layout">
            <section className="lesson-list">
              <div className="section-heading">
                <div>
                  <p className="dashboard-kicker">COURSE CURRICULUM</p>
                  <h2>Interactive Lessons</h2>
                </div>
              </div>
              {courseLessons.map((lessonItem, index) => {
                const isComplete = completedLessons.includes(lessonItem.id);
                return (
                  <button
                    className={`lesson-row ${isComplete ? "complete" : ""} ${!isDepositPaid ? "locked" : ""}`}
                    type="button"
                    key={lessonItem.id}
                    onClick={() => {
                      if (!isDepositPaid) {
                        setPreviewLesson(lessonItem);
                      } else {
                        setActiveLesson(lessonItem);
                      }
                    }}
                  >
                    <span className="lesson-number">0{index + 1}</span>
                    <span className="lesson-title">
                      <small>{lessonItem.category.toUpperCase()} · {lessonItem.estimatedTime}</small>
                      {lessonItem.title}
                    </span>
                    <span
                      className="lesson-status"
                      aria-label={isComplete ? "Completed" : !isDepositPaid ? "Locked (Click to Preview)" : "Open Lesson"}
                    >
                      {isComplete ? "\u2713" : !isDepositPaid ? "🔒" : "▶"}
                    </span>
                  </button>
                );
              })}
            </section>
            <aside className="course-note">
              <span aria-hidden="true">&#10022;</span>
              <p>Two-Stage Tuition Flexibility</p>
              <small>
                {isDepositPaid
                  ? "Deposit active. Learn all lessons in the interactive classroom at your pace. The final balance is only due when sitting for the exam."
                  : "Pay only $15 now to study the full curriculum and prompt labs before committing to the exam fee."}
              </small>
            </aside>
          </div>

          {/* ── STAGE 2: ASSESSMENT & FINAL EXAM SECTION ── */}
          <section className={`assessment-card ${progress < 100 ? "locked" : ""}`}>
            <div className="assessment-icon" aria-hidden="true">&#10003;</div>
            <div>
              <p className="dashboard-kicker">STAGE 2 · FINAL CERTIFICATION EXAM</p>
              <h2>
                {isCertified
                  ? "Your certificate is ready."
                  : !isExamPaid
                  ? "Final Exam & Credential Lock"
                  : "Final Examination Unlocked"}
              </h2>
              <p>
                {progress < 100
                  ? `Finish all ${courseLessons.length} lessons to unlock the certification examination.`
                  : isCertified
                  ? "You have completed this learning path and passed the final assessment."
                  : !isExamPaid
                  ? `Great work completing all lessons! Pay the remaining tuition balance of ${certification.examPrice} to take the timed final exam and earn your certificate.`
                  : "You are cleared for the final exam. Click below to begin the timed assessment."}
              </p>

              {/* Notice when lessons are done but exam balance not yet paid */}
              {progress === 100 && !isExamPaid && (
                <div className="exam-unlock-callout">
                  <div className="exam-unlock-header">
                    <span className="exam-unlock-title">Remaining Balance Due: {certification.examPrice}</span>
                    <span className="stage-pill exam-pending">Exam Locked</span>
                  </div>
                  <p className="exam-unlock-desc">
                    Tuition deposit of {certification.depositPrice} was credited. Completing the remaining {certification.examPrice} payment will unlock your 5-question scenario examination and certificate.
                  </p>
                </div>
              )}
            </div>

            {isCertified ? (
              <button
                className="continue-button"
                type="button"
                onClick={() => setShowCertificate(true)}
              >
                View certificate <span aria-hidden="true">&#8594;</span>
              </button>
            ) : progress === 100 && !isExamPaid ? (
              <button
                className="continue-button"
                type="button"
                id="btn-unlock-exam"
                onClick={() => setPaymentModalState({ isOpen: true, purpose: "exam_balance" })}
              >
                Pay {certification.examPrice} with Stripe <span aria-hidden="true">&#8594;</span>
              </button>
            ) : (
              <button
                className="continue-button"
                type="button"
                disabled={progress < 100 || !isExamPaid}
                onClick={() => setIsExamOpen(true)}
              >
                Take certification exam <span aria-hidden="true">&#8594;</span>
              </button>
            )}
          </section>
        </section>
      </main>

      {/* Stripe Payment Modal */}
      {paymentModalState.isOpen && (
        <PaymentModal
          certification={certification}
          purpose={paymentModalState.purpose}
          onClose={() => setPaymentModalState((s) => ({ ...s, isOpen: false }))}
          onSimulatedPayment={applyEnrollment}
        />
      )}

      {/* Interactive Classroom Modal */}
      {activeLesson && (
        <ClassroomModal
          course={courseData}
          lesson={activeLesson}
          completedLessons={completedLessons}
          onCompleteLesson={toggleLesson}
          onSelectLesson={(newLesson) => setActiveLesson(newLesson)}
          onClose={() => setActiveLesson(null)}
        />
      )}

      {/* Locked Lesson Preview Modal */}
      {previewLesson && (
        <LessonPreviewModal
          course={courseData}
          lesson={previewLesson}
          onUnlockWithDeposit={() => setPaymentModalState({ isOpen: true, purpose: "deposit" })}
          onClose={() => setPreviewLesson(null)}
        />
      )}

      {/* Proctored Certification Exam Modal */}
      {isExamOpen && (
        <CertificationExamModal
          course={courseData}
          onPassExam={(result) => {
            setIsExamOpen(false);
            completeAssessment(result);
          }}
          onClose={() => setIsExamOpen(false)}
        />
      )}
    </>
  );
}

function Dashboard({
  email,
  hasPassword,
  onSignOut,
  onPasswordAdded,
  checkoutReturn,
}: {
  email: string;
  hasPassword: boolean;
  onSignOut: (everywhere?: boolean) => void;
  onPasswordAdded: () => void;
  checkoutReturn?: { courseId: string; enrollment: EnrollmentState | null; notice: string } | null;
}) {
  const [selectedCertification, setSelectedCertification] = useState<Certification | null>(
    () => certifications.find((c) => c.id === checkoutReturn?.courseId) ?? null
  );

  if (selectedCertification) {
    const returning = checkoutReturn?.courseId === selectedCertification.id ? checkoutReturn : null;
    return (
      <CertificationCourse
        certification={selectedCertification}
        email={email}
        initialEnrollment={returning?.enrollment}
        notice={returning?.notice}
        onBack={() => setSelectedCertification(null)}
      />
    );
  }

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand-mark dashboard-logo">
          <span className="brand-mark-icon">C</span>
          <span>Claude Academy</span>
        </div>
        <nav className="dashboard-nav" aria-label="Main navigation">
          <a className="active" href="#overview"><span aria-hidden="true">&#9673;</span> Overview</a>
          <a href="#certifications"><span aria-hidden="true">&#10003;</span> Certifications</a>
          <a href="#library"><span aria-hidden="true">&#9638;</span> Learning library</a>
        </nav>
        <div className="sidebar-bottom">
          <a href="#help"><span aria-hidden="true">?</span> Help center</a>
          <button type="button" onClick={() => onSignOut(false)}><span aria-hidden="true">&#8592;</span> Sign out</button>
        </div>
      </aside>

      <section className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-kicker">YOUR LEARNING SPACE</p>
            <h1>Choose a course to <em>enroll</em></h1>
            <p className="dashboard-subtitle">
              Welcome, {email.split("@")[0]}. Enroll with a flexible deposit, study the curriculum, and pay the remainder at examination.
            </p>
          </div>
          <AccountMenu email={email} hasPassword={hasPassword} onSignOut={onSignOut} onPasswordAdded={onPasswordAdded} />
        </header>

        <div className="dashboard-grid" id="overview">
          <section className="progress-card">
            <div>
              <p className="dashboard-kicker">YOUR PROGRESS</p>
              <h2>Keep building.</h2>
              <p className="progress-copy">
                Start with a $15 deposit to unlock your lessons. Pay the exam balance when ready.
              </p>
              <button
                className="continue-button"
                type="button"
                onClick={() => setSelectedCertification(certifications[0])}
              >
                Enroll with Deposit ({certifications[0].depositPrice}) <span aria-hidden="true">&#8594;</span>
              </button>
            </div>
            <div className="progress-ring" aria-label="0 percent complete">
              <strong>0%</strong><span>complete</span>
            </div>
          </section>

          <section className="streak-card">
            <span className="streak-icon" aria-hidden="true">&#10022;</span>
            <p className="dashboard-kicker">PAYMENT INTEGRATION</p>
            <strong>Stripe Ready</strong>
            <p>Flexible 2-stage payments with comprehensive failure and success handling.</p>
            <div className="week-dots" aria-label="Weekly activity">
              <span /><span /><span /><span /><span /><span /><span />
            </div>
            <small>STAGE 1: DEPOSIT · STAGE 2: EXAM</small>
          </section>
        </div>

        <section className="certification-section" id="certifications">
          <div className="section-heading">
            <div>
              <p className="dashboard-kicker">COURSE ENROLLMENT</p>
              <h2>Available Certifications</h2>
            </div>
            <a href="#all-certifications">View all <span aria-hidden="true">&#8594;</span></a>
          </div>
          <div className="certification-list">
            {certifications.map((certification, index) => (
              <article className={`certification-card ${certification.tone}`} key={certification.title}>
                <div className="cert-number">0{index + 1}</div>
                <div className="cert-details">
                  <p className="cert-level">{certification.level}</p>
                  <h3>{certification.title}</h3>
                  <p>{certification.description}</p>
                  <div style={{ display: "flex", gap: "10px", marginTop: "8px", fontSize: "11px", color: "#527a67" }}>
                    <span>&#9719; {certification.duration}</span>
                    <span>Deposit: {certification.depositPrice}</span>
                    <span>Total: {certification.totalPrice}</span>
                  </div>
                </div>
                <button
                  className="round-arrow"
                  type="button"
                  aria-label={`Enroll in ${certification.title}`}
                  onClick={() => setSelectedCertification(certification)}
                >
                  &#8594;
                </button>
              </article>
            ))}
          </div>
        </section>
        <p style={{ fontSize: "11px", color: "#788780", margin: "32px 0 8px" }}>{DISCLAIMER}</p>
      </section>
    </main>
  );
}

type AuthMode = "register" | "signin" | "forgot";
type Account = { email: string; hasPassword: boolean };

const AUTH_ERRORS: Record<string, string> = {
  google_unavailable: "Google sign-in isn't set up yet. Use your email instead.",
  google_cancelled: "Google sign-in was cancelled.",
  google_unverified: "Your Google account's email isn't verified, so it can't be used here.",
  google_failed: "Google sign-in didn't work. Please try again.",
};

export default function Home() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [mode, setMode] = useState<AuthMode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [checkoutReturn, setCheckoutReturn] = useState<{ courseId: string; enrollment: EnrollmentState | null; notice: string } | null>(null);

  // Signed in = valid server session cookie. Nothing about the account is trusted from the browser.
  useEffect(() => {
    async function init() {
      const params = new URLSearchParams(window.location.search);
      const requestedMode = params.get("mode");
      if (requestedMode === "signin" || requestedMode === "forgot") setMode(requestedMode);
      if (params.get("auth_error")) setAuthError(AUTH_ERRORS[params.get("auth_error")!] || "Sign-in failed. Please try again.");
      if (requestedMode || params.get("auth_error")) window.history.replaceState(null, "", window.location.pathname);

      fetch("/api/auth/providers").then((r) => r.json()).then((d) => setGoogleEnabled(Boolean(d.google))).catch(() => {});

      try {
        const res = await fetch("/api/auth/me");
        const data = res.ok ? await res.json() : null;
        if (!data?.authenticated || !data?.user?.email) return;
        setAccount({ email: data.user.email, hasPassword: Boolean(data.user.hasPassword) });

        // Back from Stripe Checkout?
        const outcome = params.get("checkout");
        if (outcome) window.history.replaceState(null, "", window.location.pathname);
        if (outcome === "cancelled" && params.get("course")) {
          setCheckoutReturn({ courseId: params.get("course")!, enrollment: null, notice: "Payment cancelled. You haven't been charged." });
        } else if (outcome === "success" && params.get("session_id")) {
          const confirm = await fetch(`/api/checkout/confirm?session_id=${encodeURIComponent(params.get("session_id")!)}`);
          const c = await confirm.json().catch(() => ({}));
          if (c.paid && c.courseId) {
            setCheckoutReturn({
              courseId: c.courseId,
              enrollment: c.enrollment,
              notice: c.purpose === "exam_balance" ? "Payment received. Your final exam is unlocked." : "Payment received. All lessons are unlocked.",
            });
          } else if (c.courseId) {
            setCheckoutReturn({ courseId: c.courseId, enrollment: null, notice: c.message || c.error || "We're still confirming your payment. Refresh in a moment." });
          }
        }
      } catch {
        // Treated as signed out; the form shows any login errors.
      } finally {
        setIsLoadingAuth(false);
      }
    }
    init();
  }, []);

  function switchMode(next: AuthMode) {
    setMode(next);
    setAuthError("");
    setAuthNotice("");
    setPassword("");
  }

  async function handleEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsConnecting(true);
    setAuthError("");
    setAuthNotice("");
    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === "forgot") {
        const r = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok) setAuthNotice(d.message || "If an account exists for that email, we've sent a reset link.");
        else setAuthError(d.error || "We couldn't send the reset email. Please try again.");
        return;
      }

      const response = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password, rememberMe }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAuthError(data.error || "Sign-in failed. Please try again.");
        return;
      }
      setAccount({ email: data.user.email, hasPassword: true });
      setPassword("");
    } catch {
      setAuthError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleSignOut(everywhere = false) {
    try {
      await fetch(`/api/auth/logout${everywhere ? "?all=1" : ""}`, { method: "POST" });
    } catch {}
    setAccount(null);
    setCheckoutReturn(null);
    setEmail("");
    setMode("signin");
    if (everywhere) setAuthNotice("You've been signed out on all devices.");
  }

  if (isLoadingAuth) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f7f5f0" }}>
        <div style={{ textAlign: "center", color: "#647b6e", fontFamily: "Georgia, serif" }}>
          <div style={{ width: "32px", height: "32px", border: "2px solid #bdd8ca", borderTopColor: "#1b2925", borderRadius: "50%", margin: "0 auto 14px", display: "inline-block" }} />
          <p>Verifying secure session…</p>
        </div>
      </main>
    );
  }

  if (account) {
    return (
      <Dashboard
        email={account.email}
        hasPassword={account.hasPassword}
        onSignOut={handleSignOut}
        onPasswordAdded={() => setAccount((a) => (a ? { ...a, hasPassword: true } : a))}
        checkoutReturn={checkoutReturn}
      />
    );
  }

  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <div className="brand-mark" aria-label="Claude Academy home">
          <span className="brand-mark-icon">C</span>
          <span>Claude Academy</span>
        </div>

        <div className="brand-copy">
          <p className="eyebrow">Independent courses for building with Claude</p>
          <h1>Build with confidence. <em>Earn your proof.</em></h1>
          <p className="brand-description">
            Master Claude, validate your skills, and join a growing community of thoughtful AI builders.
          </p>
        </div>

        <div className="brand-footer">
          <div className="avatar-stack" aria-hidden="true">
            <span>JM</span><span>RK</span><span>AL</span><span>+2k</span>
          </div>
          <p><strong>2,000+ builders</strong><br />are already learning here</p>
        </div>
      </section>

      <section className="form-panel">
        <div className="form-wrap">
          <div className="mobile-brand brand-mark">
            <span className="brand-mark-icon">C</span>
            <span>Claude Academy</span>
          </div>
          <>
            <div className="form-heading">
              <h2>{mode === "register" ? "Start your journey" : mode === "signin" ? "Welcome back" : "Reset your password"}</h2>
              <p>
                {mode === "register"
                  ? "Create your account to begin your certification path."
                  : mode === "signin"
                  ? "Sign in to continue your certification path."
                  : "Enter your account email and we'll send you a link to choose a new password."}
              </p>
            </div>

            {googleEnabled && mode !== "forgot" && (
              <>
                <a className="google-button" href={`/api/auth/google?remember=${rememberMe ? "1" : "0"}`} style={{ textDecoration: "none" }}>
                  <span className="google-icon" aria-hidden="true">G</span>
                  Continue with Google
                  <span className="button-arrow" aria-hidden="true">&#8594;</span>
                </a>
                <div className="divider"><span>or continue with email</span></div>
              </>
            )}

            <form className="email-form" onSubmit={handleEmailAuth}>
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />

              {mode !== "forgot" && (
                <>
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                    minLength={mode === "register" ? 8 : undefined}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  {mode === "register" && (
                    <small className="field-hint">At least 8 characters. Avoid common passwords and your email name.</small>
                  )}

                  <label className="remember-me-row">
                    <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
                    <span>Show password</span>
                  </label>
                  <label className="remember-me-row">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                    <span>Keep me signed in on this device (30 days)</span>
                  </label>
                </>
              )}

              <button className="email-button" type="submit" disabled={isConnecting}>
                {isConnecting
                  ? "Please wait…"
                  : mode === "register" ? "Create account" : mode === "signin" ? "Sign in" : "Email me a reset link"}
                <span aria-hidden="true">&#8594;</span>
              </button>
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              {authNotice && <p className="auth-success" role="status">{authNotice}</p>}
            </form>

            {mode === "signin" && (
              <p className="signin-prompt">
                <button type="button" className="text-button" onClick={() => switchMode("forgot")}>Forgot your password?</button>
                {googleEnabled && <><br /><small>Signed up with Google? Use “Continue with Google”.</small></>}
              </p>
            )}
            {mode === "register" && <p className="terms">By continuing, you agree to our <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.</p>}
            <p className="signin-prompt">
              {mode === "register" ? "Already have an account?" : mode === "signin" ? "New to Claude Academy?" : "Remembered it?"}{" "}
              <button type="button" className="text-button" onClick={() => switchMode(mode === "signin" ? "register" : "signin")}>
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </>
        </div>
        <p className="copyright">&#169; {new Date().getFullYear()} Claude Academy · {DISCLAIMER}</p>
      </section>
    </main>
  );
}
