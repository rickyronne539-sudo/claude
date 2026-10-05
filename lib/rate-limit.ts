// Simple rate limiting backed by MongoDB, so limits hold across server instances.
import { prisma } from "./prisma";

export type Limit = { key: string; max: number; windowMs: number };

/**
 * Returns how many minutes until the caller may try again, or 0 if allowed.
 * `limits` are checked together (e.g. per email AND per IP).
 */
export async function retryAfterMinutes(limits: Limit[]): Promise<number> {
  const now = Date.now();
  let waitMs = 0;
  for (const l of limits) {
    const since = new Date(now - l.windowMs);
    const count = await prisma.authAttempt.count({ where: { key: l.key, createdAt: { gte: since } } });
    if (count >= l.max) {
      // Allowed again once the oldest attempt in the window drops out.
      const oldest = await prisma.authAttempt.findFirst({
        where: { key: l.key, createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
        skip: count - l.max,
      });
      const until = (oldest?.createdAt.getTime() ?? now) + l.windowMs;
      waitMs = Math.max(waitMs, until - now);
    }
  }
  return waitMs > 0 ? Math.ceil(waitMs / 60_000) : 0;
}

export async function recordAttempt(...keys: string[]) {
  await prisma.authAttempt.createMany({ data: keys.map((key) => ({ key })) });
  // Now and then, drop attempts older than a day.
  if (Math.random() < 0.02) {
    prisma.authAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86400_000) } } }).catch(() => {});
  }
}

export async function clearAttempts(key: string) {
  await prisma.authAttempt.deleteMany({ where: { key } });
}

export const tooMany = (minutes: number) => ({
  error: `Too many attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`,
});

const MIN = 60_000;
export const LIMITS = {
  loginEmail: (email: string): Limit => ({ key: `login-email:${email}`, max: 5, windowMs: 15 * MIN }),
  loginIp: (ip: string): Limit => ({ key: `login-ip:${ip}`, max: 30, windowMs: 15 * MIN }),
  registerIp: (ip: string): Limit => ({ key: `register-ip:${ip}`, max: 10, windowMs: 60 * MIN }),
  resetEmail: (email: string): Limit => ({ key: `reset-email:${email}`, max: 3, windowMs: 60 * MIN }),
  resetIp: (ip: string): Limit => ({ key: `reset-ip:${ip}`, max: 10, windowMs: 60 * MIN }),
  changePassword: (userId: string): Limit => ({ key: `change-pw:${userId}`, max: 5, windowMs: 15 * MIN }),
};
