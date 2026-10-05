// Sends email through Resend (https://resend.com) using its HTTP API, no SDK needed.
// Without RESEND_API_KEY: in development the email is printed to the server console;
// in production sending fails loudly in the logs.

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail({ to, subject, text, html }: { to: string; subject: string; text: string; html: string }) {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[mail:dev] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
      return;
    }
    throw new Error("Email is not configured (set RESEND_API_KEY and MAIL_FROM).");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, text, html }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Email send failed (${res.status}): ${body.slice(0, 200)}`);
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function sendPasswordResetEmail(to: string, link: string) {
  const subject = "Reset your Claude Academy password";
  const text = `We received a request to reset your password.\n\nOpen this link to choose a new one (it works once and expires in 1 hour):\n${link}\n\nIf you didn't ask for this, you can ignore this email; your password stays the same.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1b2925">
  <h2 style="font-family:Georgia,serif">Reset your password</h2>
  <p>We received a request to reset your Claude Academy password.</p>
  <p style="margin:28px 0"><a href="${esc(link)}" style="background:#1b2925;color:#fff;padding:12px 22px;text-decoration:none;display:inline-block">Choose a new password</a></p>
  <p style="font-size:13px;color:#64776e">The link works once and expires in 1 hour. If you didn't ask for this, ignore this email; your password stays the same.</p>
  <p style="font-size:12px;color:#64776e;word-break:break-all">${esc(link)}</p>
</div>`;
  await sendMail({ to, subject, text, html });
}
