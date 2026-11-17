"use client";

import { AuthUser } from "./types";

const MPIN_HASH_PREFIX = "parkflow:mpin:";
const MPIN_UNLOCKED_PREFIX = "parkflow:mpin-unlocked:";

export function mpinHashKey(userId: string) {
  return `${MPIN_HASH_PREFIX}${userId}`;
}

export function mpinUnlockedKey(userId: string) {
  return `${MPIN_UNLOCKED_PREFIX}${userId}`;
}

function legacyTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function hasMpinForUser(userId: string) {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(mpinHashKey(userId)));
}

export function isMpinUnlocked(userId: string) {
  if (typeof window === "undefined") return false;
  const key = mpinUnlockedKey(userId);
  if (window.localStorage.getItem(key) === "true") return true;

  // Carry forward a valid unlock from the previous per-day session marker.
  const legacyMarker = window.sessionStorage.getItem(key);
  if (legacyMarker && legacyMarker === legacyTodayKey()) {
    window.localStorage.setItem(key, "true");
    return true;
  }
  return false;
}

export function markMpinUnlocked(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(mpinUnlockedKey(userId), "true");
}

export function gatekeeperSecurityPath(user: AuthUser) {
  if (user.role !== "GATEKEEPER" && user.role !== "SECURITY_SUPERVISOR") return null;
  if (user.mustChangePassword) return "/gate/security";
  if (!hasMpinForUser(user.id)) return "/gate/security";
  if (!isMpinUnlocked(user.id)) return "/gate/security";
  return null;
}

export async function hashMpin(userId: string, mpin: string) {
  const input = `${userId}:${mpin}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
