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

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function hasMpinForUser(userId: string) {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(mpinHashKey(userId)));
}

export function isMpinUnlocked(userId: string) {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(mpinUnlockedKey(userId)) === todayKey();
}

export function markMpinUnlocked(userId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(mpinUnlockedKey(userId), todayKey());
}

export function gatekeeperSecurityPath(user: AuthUser) {
  if (user.role !== "GATEKEEPER") return null;
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
