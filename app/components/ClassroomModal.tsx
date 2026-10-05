"use client";

import { useState, useEffect } from "react";
import { Lesson, CertificationCourseData } from "@/lib/courses-data";

export function ClassroomModal({
  course,
  lesson,
  completedLessons,
  onCompleteLesson,
  onSelectLesson,
  onClose,
}: {
  course: CertificationCourseData;
  lesson: Lesson;
  completedLessons: string[];
  onCompleteLesson: (lessonId: string) => void;
  onSelectLesson: (lesson: Lesson) => void;
  onClose: () => void;
}) {
  const currentIndex = course.lessons.findIndex((l) => l.id === lesson.id);
  const prevLesson = currentIndex > 0 ? course.lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < course.lessons.length - 1 ? course.lessons[currentIndex + 1] : null;
  const isCompleted = completedLessons.includes(lesson.id);

  // Prompt Lab State
  const [userPromptText, setUserPromptText] = useState(lesson.promptLab?.userPrompt || "");
  const [temperature, setTemperature] = useState(lesson.promptLab?.temperature || 0.2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [simulatedOutput, setSimulatedOutput] = useState(lesson.promptLab?.simulatedOutput || "");
  const [displayedOutput, setDisplayedOutput] = useState("");
  const [hasRun, setHasRun] = useState(false);

  // Code Tab State
  const [codeTab, setCodeTab] = useState<"typescript" | "python" | "curl">("typescript");
  const [copiedCode, setCopiedCode] = useState(false);

  // Quiz State
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Challenge Hint State
  const [showHint, setShowHint] = useState(false);

  // Reset states when switching lessons
  useEffect(() => {
    if (lesson.promptLab) {
      setUserPromptText(lesson.promptLab.userPrompt);
      setTemperature(lesson.promptLab.temperature);
      setSimulatedOutput(lesson.promptLab.simulatedOutput);
      setDisplayedOutput(lesson.promptLab.simulatedOutput);
      setHasRun(true);
    }
    setSelectedQuizOption(null);
    setQuizSubmitted(false);
    setShowHint(false);
  }, [lesson]);

  function handleRunPrompt() {
    setIsGenerating(true);
    setDisplayedOutput("");
    setHasRun(false);

    const fullText = simulatedOutput;
    let idx = 0;
    const interval = setInterval(() => {
      idx += Math.min(6, fullText.length - idx);
      setDisplayedOutput(fullText.slice(0, idx));
      if (idx >= fullText.length) {
        clearInterval(interval);
        setIsGenerating(false);
        setHasRun(true);
      }
    }, 18);
  }

  function handleCopyCode() {
    if (!lesson.codeSnippet) return;
    const textToCopy = lesson.codeSnippet[codeTab];
    navigator.clipboard.writeText(textToCopy);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function handleMarkCompleteAndContinue() {
    onCompleteLesson(lesson.id);
    if (nextLesson) {
      onSelectLesson(nextLesson);
    } else {
      onClose();
    }
  }

  return (
    <div className="classroom-overlay" role="dialog" aria-modal="true" aria-label="Interactive Classroom">
      <div className="classroom-window">
        {/* Top bar */}
        <header className="classroom-topbar">
          <div className="classroom-breadcrumbs">
            <span>{course.title}</span>
            <span aria-hidden="true">&#8250;</span>
            <strong>Lesson {currentIndex + 1}: {lesson.title}</strong>
          </div>
          <div className="classroom-topbar-actions">
            {isCompleted && (
              <span className="stage-pill deposit-paid" style={{ fontSize: "10px", padding: "2px 8px" }}>
                ✓ Completed
              </span>
            )}
            <button className="classroom-close-btn" type="button" onClick={onClose} aria-label="Close classroom">
              ✕
            </button>
          </div>
        </header>

        {/* Classroom Grid */}
        <div className="classroom-grid">
          {/* Sidebar */}
          <aside className="classroom-sidebar">
            <div className="classroom-sidebar-title">CURRICULUM LESSONS</div>
            {course.lessons.map((item, idx) => {
              const itemDone = completedLessons.includes(item.id);
              const isActive = item.id === lesson.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`classroom-nav-item ${isActive ? "active" : ""}`}
                  onClick={() => onSelectLesson(item)}
                >
                  <span className="nav-item-num">0{idx + 1}</span>
                  <span className="nav-item-title">{item.title}</span>
                  {itemDone && <span className="nav-check">✓</span>}
                </button>
              );
            })}
          </aside>

          {/* Main content canvas */}
          <main className="classroom-content">
            <div className="lesson-badge-row">
              <span className="lesson-cat-pill">{lesson.category}</span>
              <span className="lesson-time-pill">&#9719; {lesson.estimatedTime}</span>
            </div>

            <h1>{lesson.title}</h1>
            <p className="lesson-lead">{lesson.summary}</p>

            {/* Learning Objectives */}
            <div className="objectives-card">
              <h4>LEARNING OBJECTIVES</h4>
              <ul>
                {lesson.objectives.map((obj, i) => (
                  <li key={i}>{obj}</li>
                ))}
              </ul>
            </div>

            {/* Concepts Deep-Dive */}
            {lesson.concepts.map((concept, i) => (
              <section key={i} className="concept-block">
                <h3>{concept.heading}</h3>
                <p>{concept.body}</p>
                {concept.callout && (
                  <div className={`concept-callout ${concept.callout.type}`}>
                    <span className="callout-title">{concept.callout.title}</span>
                    {concept.callout.text}
                  </div>
                )}
              </section>
            ))}

            {/* Interactive Prompt Lab */}
            {lesson.promptLab && (
              <div className="prompt-lab-box">
                <div className="prompt-lab-header">
                  <div className="prompt-lab-title">
                    <span>&#9654; INTERACTIVE PROMPT WORKBENCH</span>
                    <span className="model-pill">{lesson.promptLab.model}</span>
                  </div>
                  <div className="prompt-lab-controls">
                    <span>Temp: {temperature}</span>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      style={{ width: "80px", accentColor: "#6f9b87" }}
                    />
                  </div>
                </div>

                <div className="prompt-field-group">
                  <label>System Prompt</label>
                  <div className="prompt-system-text">{lesson.promptLab.systemPrompt}</div>
                </div>

                <div className="prompt-field-group">
                  <label>User Prompt (Editable)</label>
                  <textarea
                    className="prompt-editor"
                    value={userPromptText}
                    onChange={(e) => setUserPromptText(e.target.value)}
                    rows={6}
                  />
                </div>

                <div className="prompt-lab-footer">
                  <span style={{ fontSize: "11px", color: "#8aa194" }}>
                    Run directly in simulated Claude sandbox
                  </span>
                  <button
                    className="run-prompt-btn"
                    type="button"
                    onClick={handleRunPrompt}
                    disabled={isGenerating}
                  >
                    {isGenerating ? "Simulating Claude Stream…" : "▶ Run with Claude"}
                  </button>
                </div>

                {/* Output Zone */}
                <div className="prompt-output-zone">
                  <div className="prompt-output-header">
                    <span>CLAUDE RESPONSE OUTPUT</span>
                    {isGenerating && <span style={{ color: "#bdd8ca" }}>Streaming tokens…</span>}
                  </div>
                  <div className="prompt-output-content">
                    {displayedOutput || (isGenerating ? "Thinking…" : "Click 'Run with Claude' above.")}
                  </div>
                  {hasRun && (
                    <div className="prompt-metrics">
                      <span>• Latency: 240ms</span>
                      <span>• Input Tokens: ~124</span>
                      <span>• Output Tokens: ~86</span>
                      <span>• Stop Reason: end_turn</span>
                    </div>
                  )}
                  <div className="prompt-takeaway">
                    <strong>Takeaway:</strong> {lesson.promptLab.keyTakeaway}
                  </div>
                </div>
              </div>
            )}

            {/* Developer Code Snippet */}
            {lesson.codeSnippet && (
              <div className="code-viewer-box">
                <div className="code-viewer-bar">
                  <div className="code-tabs">
                    <button
                      type="button"
                      className={`code-tab-btn ${codeTab === "typescript" ? "active" : ""}`}
                      onClick={() => setCodeTab("typescript")}
                    >
                      TypeScript SDK
                    </button>
                    <button
                      type="button"
                      className={`code-tab-btn ${codeTab === "python" ? "active" : ""}`}
                      onClick={() => setCodeTab("python")}
                    >
                      Python SDK
                    </button>
                    <button
                      type="button"
                      className={`code-tab-btn ${codeTab === "curl" ? "active" : ""}`}
                      onClick={() => setCodeTab("curl")}
                    >
                      cURL
                    </button>
                  </div>
                  <button type="button" className="code-copy-btn" onClick={handleCopyCode}>
                    {copiedCode ? "✓ Copied" : "Copy Code"}
                  </button>
                </div>
                <pre className="code-content-block">
                  <code>{lesson.codeSnippet[codeTab]}</code>
                </pre>
              </div>
            )}

            {/* Knowledge Check Quiz */}
            <div className="quiz-container">
              <div className="quiz-badge">KNOWLEDGE CHECK</div>
              <h3 className="quiz-question">{lesson.quiz.question}</h3>
              <div className="quiz-options">
                {lesson.quiz.options.map((opt, i) => (
                  <label
                    key={i}
                    className={`quiz-option-label ${selectedQuizOption === i ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`quiz-${lesson.id}`}
                      checked={selectedQuizOption === i}
                      onChange={() => {
                        setSelectedQuizOption(i);
                        setQuizSubmitted(false);
                      }}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>

              {!quizSubmitted ? (
                <button
                  type="button"
                  className="quiz-submit-btn"
                  disabled={selectedQuizOption === null}
                  onClick={() => setQuizSubmitted(true)}
                >
                  Verify Answer
                </button>
              ) : (
                <div
                  className={`quiz-feedback ${
                    selectedQuizOption === lesson.quiz.correctIndex ? "correct" : "incorrect"
                  }`}
                >
                  <strong>
                    {selectedQuizOption === lesson.quiz.correctIndex
                      ? "✓ Correct!"
                      : "✕ Not quite correct"}
                  </strong>
                  <p style={{ margin: "4px 0 0" }}>{lesson.quiz.explanation}</p>
                </div>
              )}
            </div>

            {/* Practical Hands-on Challenge */}
            <div className="challenge-box">
              <div className="challenge-header">HANDS-ON EXERCISE</div>
              <p>{lesson.practicalChallenge.instruction}</p>
              <button
                type="button"
                className="challenge-hint-btn"
                onClick={() => setShowHint(!showHint)}
              >
                {showHint ? "Hide Solution Walkthrough" : "Show Solution Walkthrough →"}
              </button>
              {showHint && (
                <div className="challenge-hint-text">
                  <strong>Recommended Approach:</strong> {lesson.practicalChallenge.solutionHint}
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Bottom bar navigation */}
        <footer className="classroom-bottombar">
          <button
            type="button"
            className="classroom-nav-action-btn"
            disabled={!prevLesson}
            onClick={() => prevLesson && onSelectLesson(prevLesson)}
          >
            ← Previous Lesson
          </button>

          <button
            type="button"
            className="complete-lesson-btn"
            onClick={handleMarkCompleteAndContinue}
          >
            {isCompleted
              ? nextLesson
                ? "Next Lesson →"
                : "Done (Return to Course) ✓"
              : nextLesson
              ? "Complete & Next Lesson →"
              : "Complete Course Lessons ✓"}
          </button>
        </footer>
      </div>
    </div>
  );
}
