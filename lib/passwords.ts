// Password rules (following NIST guidance: length and a block-list, not forced symbols).

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// A short list of the most-used passwords. Extend as you like.
const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "p@ssw0rd", "12345678", "123456789", "1234567890",
  "11111111", "00000000", "87654321", "qwerty123", "qwertyuiop", "1q2w3e4r", "1q2w3e4r5t", "abc12345",
  "abcd1234", "iloveyou", "letmein1", "welcome1", "welcome123", "admin123", "sunshine", "princess",
  "football", "baseball", "superman", "trustno1", "whatever", "starwars", "dragon12", "monkey12",
  "changeme", "default1", "zaq12wsx", "asdfghjk", "asdf1234", "q1w2e3r4", "access14", "master12",
  "claude123", "anthropic", "academy1", "qwerty12", "password!", "11223344", "12341234", "aaaaaaaa",
]);

/** Returns a problem to show the user, or null if the password is fine. */
export function passwordProblem(password: unknown, email?: string): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    return `Use at least ${PASSWORD_MIN} characters.`;
  }
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;

  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "That password is too common. Choose something harder to guess.";
  if (/^(.)\1+$/.test(password)) return "Don't use the same character over and over.";

  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) {
    return "Don't include your email name in your password.";
  }
  return null;
}
