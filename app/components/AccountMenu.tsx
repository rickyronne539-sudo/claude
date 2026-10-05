"use client";

import { useEffect, useRef, useState } from "react";

// Profile button in the dashboard header: change/add password, sign out here or everywhere.
export function AccountMenu({
  email,
  hasPassword,
  onSignOut,
  onPasswordAdded,
}: {
  email: string;
  hasPassword: boolean;
  onSignOut: (everywhere: boolean) => void;
  onPasswordAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div className="account-menu" ref={ref}>
      <button type="button" className="profile-pill" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="profile-avatar">{email.slice(0, 2).toUpperCase()}</span>
        <span className="profile-email">{email}</span>
        <span className="profile-chevron" aria-hidden="true">&#8964;</span>
      </button>
      {open && (
        <div className="account-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); setChanging(true); }}>
            {hasPassword ? "Change password" : "Add a password"}
          </button>
          <button type="button" role="menuitem" onClick={() => onSignOut(true)}>Sign out on all devices</button>
          <button type="button" role="menuitem" onClick={() => onSignOut(false)}>Sign out</button>
        </div>
      )}
      {changing && (
        <PasswordModal
          hasPassword={hasPassword}
          onClose={() => setChanging(false)}
          onDone={() => { if (!hasPassword) onPasswordAdded(); }}
        />
      )}
    </div>
  );
}

function PasswordModal({ hasPassword, onClose, onDone }: { hasPassword: boolean; onClose: () => void; onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== confirm) return setError("The two new passwords don't match.");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: hasPassword ? current : undefined, newPassword: next }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setError(d.error || "We couldn't change your password.");
      setSuccess(d.message || "Password saved.");
      onDone();
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Password" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>✕</button>
        <div className="form-heading">
          <h2>{hasPassword ? "Change password" : "Add a password"}</h2>
          <p>{hasPassword ? "Other devices will be signed out." : "Then you can sign in with your email as well as Google."}</p>
        </div>
        {success ? (
          <>
            <p className="auth-success" role="status">{success}</p>
            <button className="email-button" type="button" onClick={onClose}>Done</button>
          </>
        ) : (
          <form className="email-form" onSubmit={submit}>
            {hasPassword && (
              <>
                <label htmlFor="cur-pw">Current password</label>
                <input id="cur-pw" type={show ? "text" : "password"} autoComplete="current-password" required
                  value={current} onChange={(e) => setCurrent(e.target.value)} />
              </>
            )}
            <label htmlFor="new-pw">New password</label>
            <input id="new-pw" type={show ? "text" : "password"} autoComplete="new-password" minLength={8} required
              value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 8 characters" />
            <label htmlFor="new-pw2">Confirm new password</label>
            <input id="new-pw2" type={show ? "text" : "password"} autoComplete="new-password" required
              value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <label className="remember-me-row">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              <span>Show passwords</span>
            </label>
            <button className="email-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
            {error && <p className="auth-error" role="alert">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
