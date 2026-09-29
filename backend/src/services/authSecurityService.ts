import crypto from "crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { hashPassword } from "../utils/password";
import { sendPasswordResetEmail } from "./emailService";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 5000;

type AttemptState = {
  failedCount: number;
  lockedUntil?: number;
  notifiedForLockout?: boolean;
};

const failedAttempts = new Map<string, AttemptState>();

function now() {
  return Date.now();
}

export function authKey(email: string) {
  return email.trim().toLowerCase();
}

function getAttemptState(email: string) {
  const key = authKey(email);
  const state = failedAttempts.get(key);
  if (state?.lockedUntil && state.lockedUntil <= now()) {
    failedAttempts.delete(key);
    return undefined;
  }
  return state;
}

export function isAccountLocked(email: string) {
  const state = getAttemptState(email);
  return Boolean(state?.lockedUntil && state.lockedUntil > now());
}

export async function applyProgressiveDelay(email: string) {
  const state = getAttemptState(email);
  if (!state?.failedCount) return;
  const delayMs = Math.min(state.failedCount * BASE_DELAY_MS, MAX_DELAY_MS);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function recordFailedLogin(email: string) {
  const key = authKey(email);
  const state = getAttemptState(email) ?? { failedCount: 0 };
  state.failedCount += 1;

  if (state.failedCount >= MAX_FAILED_ATTEMPTS) {
    state.lockedUntil = now() + LOCKOUT_MS;
    if (!state.notifiedForLockout) {
      state.notifiedForLockout = true;
      await sendPasswordResetEmail(email, buildResetLink(email));
    }
  }

  failedAttempts.set(key, state);
  await applyProgressiveDelay(email);
}

export function clearFailedLogin(email: string) {
  failedAttempts.delete(authKey(email));
}

function buildResetLink(email: string) {
  const origin = env.corsOrigin[0] ?? "http://localhost:3000";
  const token = crypto.createHash("sha256").update(`${email}:${env.jwt.refreshSecret}`).digest("hex");
  return `${origin.replace(/\/$/, "")}/reset-password?token=${token}`;
}

function timingSafeStringEqual(a: string, b: string) {
  const secret = env.jwt.accessSecret;
  const aDigest = crypto.createHmac("sha256", secret).update(a).digest();
  const bDigest = crypto.createHmac("sha256", secret).update(b).digest();
  return crypto.timingSafeEqual(aDigest, bDigest);
}

function isBcryptHash(value: string) {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

export async function verifyPasswordAndGetMigrationHash(plain: string, stored: string) {
  if (isBcryptHash(stored)) {
    return { valid: await bcrypt.compare(plain, stored), migrationHash: null };
  }

  let valid = timingSafeStringEqual(plain, stored);

  if (!valid && /^[a-f0-9]{32}$/i.test(stored)) {
    valid = timingSafeStringEqual(crypto.createHash("md5").update(plain).digest("hex"), stored.toLowerCase());
  }

  if (!valid && /^[a-f0-9]{40}$/i.test(stored)) {
    valid = timingSafeStringEqual(crypto.createHash("sha1").update(plain).digest("hex"), stored.toLowerCase());
  }

  return { valid, migrationHash: valid ? await hashPassword(plain) : null };
}
