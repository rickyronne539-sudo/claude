// "Sign in with Google" via OAuth 2.0 authorization code flow with PKCE and a state check.
// Turned on by setting GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
import crypto from "crypto";

export const GOOGLE_STATE_COOKIE = "ca_google_oauth";

export const googleConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const googleRedirectUri = (appUrl: string) => `${appUrl}/api/auth/google/callback`;

const b64url = (buf: Buffer) => buf.toString("base64url");

/** Creates the Google sign-in URL plus the secrets to keep in a short-lived cookie. */
export function googleAuthRequest(appUrl: string, rememberMe: boolean) {
  const state = b64url(crypto.randomBytes(24));
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(appUrl),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  return { url: url.toString(), cookieValue: JSON.stringify({ state, verifier, rememberMe }) };
}

export type GoogleProfile = { sub: string; email: string; email_verified: boolean; name?: string };

/** Exchanges the code for tokens and returns the Google profile. */
export async function googleProfileFromCode(code: string, verifier: string, appUrl: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(appUrl),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }).toString(),
    cache: "no-store",
  });
  const tokens = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokens.access_token) throw new Error(tokens.error_description || "Google sign-in failed.");

  // Ask Google directly who the token belongs to (avoids hand-verifying the ID token).
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
  });
  const info = await infoRes.json().catch(() => ({}));
  if (!infoRes.ok || !info.sub || !info.email) throw new Error("Couldn't read your Google profile.");
  return { sub: String(info.sub), email: String(info.email).toLowerCase(), email_verified: Boolean(info.email_verified), name: info.name };
}
