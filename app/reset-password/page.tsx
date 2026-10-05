"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
}

function ResetPassword() {
  const token = useSearchParams().get("token") || "";
  const [email, setEmail] = useState<string | null>(null);
  const [checkError, setCheckError] = useState("");
  const linkError = token ? checkError : "This link is missing its code. Open the link from your email again.";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.ok) setEmail(d.email);
        else setCheckError(d.error || "This reset link is invalid or has expired.");
      })
      .catch(() => setCheckError("We couldn't check the link. Check your connection and reload the page."));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setDone(true);
      else setError(d.error || "We couldn't change your password.");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell" style={{ gridTemplateColumns: "1fr" }}>
      <section className="form-panel">
        <div className="form-wrap">
          <div className="brand-mark">
            <span className="brand-mark-icon">C</span>
            <span>Claude Academy</span>
          </div>
          <div className="form-heading">
            <h2>Choose a new password</h2>
            {email && <p>For {email}. You&apos;ll be signed out on all devices.</p>}
          </div>

          {linkError && (
            <>
              <p className="auth-error" role="alert">{linkError}</p>
              <p className="signin-prompt"><Link className="text-button" href="/?mode=forgot">Request a new link</Link></p>
            </>
          )}

          {done && (
            <>
              <p className="auth-success" role="status">Password changed. Sign in with your new password.</p>
              <Link className="email-button" href="/?mode=signin" style={{ textAlign: "center", textDecoration: "none" }}>Go to sign in <span aria-hidden="true">&#8594;</span></Link>
            </>
          )}

          {email && !done && (
            <form className="email-form" onSubmit={submit}>
              <label htmlFor="new-password">New password</label>
              <input id="new-password" type={show ? "text" : "password"} autoComplete="new-password" minLength={8} required
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
              <label htmlFor="confirm-password">Confirm new password</label>
              <input id="confirm-password" type={show ? "text" : "password"} autoComplete="new-password" required
                value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              <label className="remember-me-row">
                <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
                <span>Show passwords</span>
              </label>
              <button className="email-button" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save new password"} <span aria-hidden="true">&#8594;</span>
              </button>
              {error && <p className="auth-error" role="alert">{error}</p>}
            </form>
          )}

          {!email && !linkError && <p>Checking your link…</p>}
        </div>
      </section>
    </main>
  );
}
