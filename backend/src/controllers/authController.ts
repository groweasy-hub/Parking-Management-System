import { Request, Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { User } from "../models";
import { hashPassword } from "../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { env, isProduction } from "../config/env";
import { recordAudit } from "../services/auditService";
import { disconnectUserSessions } from "../realtime/socketServer";
import { phoneDigits, phoneLookupPattern, sanitizeEmail, sanitizeHumanName, sanitizePassword, sanitizePhone } from "../utils/sanitize";
import {
  applyProgressiveDelay,
  clearFailedLogin,
  isAccountLocked,
  recordFailedLogin,
  verifyPasswordAndGetMigrationHash,
} from "../services/authSecurityService";

const GENERIC_LOGIN_ERROR = "Incorrect work email, mobile number, or password.";
const GENERIC_PASSWORD_CHANGE_ERROR = "Unable to change password.";
const GENERIC_PROFILE_UPDATE_ERROR = "Unable to update profile.";

export const loginSchema = z.object({
  email: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      return value.includes("@") ? sanitizeEmail(value) : sanitizePhone(value);
    },
    z.string().min(5).max(254).refine((value) => {
      if (value.includes("@")) return z.string().email().safeParse(value).success;
      const digits = phoneDigits(value);
      return digits.length >= 7 && digits.length <= 20;
    }, "Enter a valid work email or mobile number.")
  ),
  password: z.preprocess(
    (value) => (typeof value === "string" ? sanitizePassword(value) : value),
    z.string().min(8).max(128)
  ),
});

export const changePasswordSchema = z.object({
  oldPassword: z.preprocess(
    (value) => (typeof value === "string" ? sanitizePassword(value) : value),
    z.string().min(1).max(128)
  ),
  newPassword: z.preprocess(
    (value) => (typeof value === "string" ? sanitizePassword(value) : value),
    z.string().min(8).max(128)
  ),
});

export const forgotPasswordSchema = z.object({
  email: z.preprocess(
    (value) => (typeof value === "string" ? sanitizeEmail(value) : value),
    z.string().min(5).max(254).email()
  ),
});

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, "Your reset session is invalid. Please check your email address again."),
  newPassword: changePasswordSchema.shape.newPassword,
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as z.infer<typeof forgotPasswordSchema>;
  const user = await User.findOne({ email, status: "ACTIVE" });
  if (!user) {
    throw AppError.notFound("No active account was found with this email. Please check your email address.", "EMAIL_NOT_FOUND");
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await User.updateOne({ _id: user._id }, { $set: {
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
  } });

  // Product requirement: matching an active registered email permits recovery.
  // This token limits the checked-email session; it does not prove inbox ownership.
  res.setHeader("Cache-Control", "no-store");
  res.json({ message: "Email address found. You can now create a new password.", resetToken: token });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body as z.infer<typeof resetPasswordSchema>;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const passwordHash = await hashPassword(newPassword);
  // Consume the token and update the password atomically to prevent link reuse.
  const user = await User.findOneAndUpdate({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
    status: "ACTIVE",
  }, {
    $set: { passwordHash, mustChangePassword: false },
    $inc: { sessionVersion: 1 },
    $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
  }, { new: true });
  if (!user) {
    throw AppError.badRequest("Your reset session is invalid or expired. Please check your email address again.", "INVALID_RESET_TOKEN");
  }
  clearFailedLogin(user.email);
  disconnectUserSessions(String(user._id));
  res.clearCookie("accessToken", { domain: ACCESS_COOKIE_OPTIONS.domain });
  res.clearCookie("refreshToken", { domain: ACCESS_COOKIE_OPTIONS.domain, path: "/api/auth" });
  await recordAudit({
    userId: String(user._id),
    projectId: user.projectId ? String(user.projectId) : null,
    action: "PASSWORD_RESET",
    entityType: "User",
    entityId: user._id as never,
  });
  res.json({ message: "Your password has been reset. You can now sign in with your new password." });
});

export const updateProfileSchema = z
  .object({
    name: z.preprocess(
      (value) => (typeof value === "string" ? sanitizeHumanName(value) : value),
      z.string().min(2).max(80)
    ),
    email: z.preprocess(
      (value) => (typeof value === "string" ? sanitizeEmail(value) : value),
      z.string().min(5).max(254).email()
    ),
    phone: z.preprocess(
      (value) => (typeof value === "string" ? sanitizePhone(value) : value),
      z.string().max(25).optional()
    ),
    currentPassword: z.preprocess(
      (value) => (typeof value === "string" ? sanitizePassword(value) : value),
      z.string().max(128).optional()
    ),
    newPassword: z.preprocess(
      (value) => (typeof value === "string" ? sanitizePassword(value) : value),
      z.string().min(8).max(128).optional()
    ),
  })
  .refine((data) => !data.newPassword || Boolean(data.currentPassword), {
    path: ["currentPassword"],
    message: "Current password is required.",
  });

// In production the frontend (Vercel) and backend typically live on
// different registrable domains, so cookies must be SameSite=None+Secure to
// survive the cross-site fetch; in local dev http://localhost keeps Lax so
// it also works without HTTPS.
const USE_CROSS_SITE_COOKIES =
  isProduction ||
  Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.RENDER_SERVICE_ID);

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: USE_CROSS_SITE_COOKIES,
  sameSite: (USE_CROSS_SITE_COOKIES ? "none" : "lax") as "none" | "lax",
  domain: env.cookieDomain === "localhost" ? undefined : env.cookieDomain,
  maxAge: 15 * 60 * 1000,
};

const REFRESH_COOKIE_OPTIONS = {
  ...ACCESS_COOKIE_OPTIONS,
  maxAge: 45 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
};

function buildTokens(user: {
  _id: unknown;
  role: string;
  projectId?: unknown;
  gateId?: unknown;
  sessionVersion?: number;
}) {
  const accessToken = signAccessToken({
    sub: String(user._id),
    role: user.role as never,
    projectId: user.projectId ? String(user.projectId) : null,
    gateId: user.gateId ? String(user.gateId) : null,
    sessionVersion: user.sessionVersion ?? 0,
  });
  const refreshToken = signRefreshToken(String(user._id), user.sessionVersion ?? 0);
  return { accessToken, refreshToken };
}

function serializeAuthUser(user: {
  _id: unknown;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  mustChangePassword?: boolean;
  projectId?: unknown;
  gateId?: unknown;
}) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    projectId: user.projectId,
    gateId: user.gateId,
  };
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email: identifier, password } = req.body as z.infer<typeof loginSchema>;
  const isEmail = identifier.includes("@");
  const identifierKey = isEmail ? identifier.toLowerCase() : `phone:${phoneDigits(identifier)}`;
  const phonePattern = isEmail ? null : phoneLookupPattern(identifier);
  let user = isEmail
    ? await User.findOne({ email: identifier.toLowerCase() }).select("+passwordHash")
    : null;

  if (!isEmail && phonePattern) {
    const matches = await User.find({ phone: { $regex: phonePattern }, status: "ACTIVE" }).select("+passwordHash").limit(2);
    // Refuse ambiguous phone numbers rather than choosing an account arbitrarily.
    if (matches.length === 1) user = matches[0];
  }

  const attemptKeys = user ? [identifierKey, `user:${String(user._id)}`] : [identifierKey];
  if (attemptKeys.some(isAccountLocked)) {
    await Promise.all(attemptKeys.map(applyProgressiveDelay));
    throw AppError.unauthorized(GENERIC_LOGIN_ERROR, "INVALID_CREDENTIALS");
  }

  if (!user || user.status !== "ACTIVE") {
    await Promise.all(attemptKeys.map(recordFailedLogin));
    throw AppError.unauthorized(GENERIC_LOGIN_ERROR, "INVALID_CREDENTIALS");
  }

  const { valid, migrationHash } = await verifyPasswordAndGetMigrationHash(password, user.passwordHash);
  if (!valid) {
    await Promise.all(attemptKeys.map(recordFailedLogin));
    throw AppError.unauthorized(GENERIC_LOGIN_ERROR, "INVALID_CREDENTIALS");
  }

  attemptKeys.forEach(clearFailedLogin);
  if (migrationHash) {
    user.passwordHash = migrationHash;
  }
  user.lastLoginAt = new Date();
  await user.save();

  const { accessToken, refreshToken } = buildTokens(user);
  res.cookie("accessToken", accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

  await recordAudit({
    userId: String(user._id),
    projectId: user.projectId ? String(user.projectId) : null,
    action: "USER_LOGIN",
    entityType: "User",
    entityId: user._id as never,
  });

  res.json({
    accessToken,
    user: serializeAuthUser(user),
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await recordAudit({
      userId: req.user.id,
      projectId: req.user.projectId,
      action: "USER_LOGOUT",
      entityType: "User",
      entityId: req.user.id,
    });
  }
  res.clearCookie("accessToken", { domain: ACCESS_COOKIE_OPTIONS.domain });
  res.clearCookie("refreshToken", { domain: ACCESS_COOKIE_OPTIONS.domain, path: "/api/auth" });
  res.json({ success: true });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw AppError.unauthorized();

  let payload: { sub: string; sessionVersion?: number };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw AppError.unauthorized("Session expired. Please log in again.", "TOKEN_INVALID");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== "ACTIVE" || (user.sessionVersion ?? 0) !== (payload.sessionVersion ?? 0)) throw AppError.unauthorized();

  const { accessToken, refreshToken } = buildTokens(user);
  res.cookie("accessToken", accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
  res.json({ accessToken });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const user = await User.findById(req.user.id).lean();
  if (!user) throw AppError.unauthorized();
  res.json({
    user: serializeAuthUser(user),
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const { oldPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;

  const user = await User.findById(req.user.id).select("+passwordHash +passwordResetTokenHash +passwordResetExpiresAt");
  if (!user || user.status !== "ACTIVE") throw AppError.unauthorized();

  const { valid } = await verifyPasswordAndGetMigrationHash(oldPassword, user.passwordHash);
  if (!valid) {
    throw AppError.badRequest(GENERIC_PASSWORD_CHANGE_ERROR, "PASSWORD_CHANGE_FAILED");
  }

  user.passwordHash = await hashPassword(newPassword);
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  user.mustChangePassword = false;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();
  disconnectUserSessions(String(user._id));
  const tokens = buildTokens(user);
  res.cookie("accessToken", tokens.accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

  await recordAudit({
    userId: String(user._id),
    projectId: user.projectId ? String(user.projectId) : null,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user._id as never,
  });

  res.json({
    accessToken: tokens.accessToken,
    user: serializeAuthUser(user),
  });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();

  const data = req.body as z.infer<typeof updateProfileSchema>;
  const normalizedEmail = data.email.toLowerCase();

  const user = await User.findById(req.user.id).select("+passwordHash +passwordResetTokenHash +passwordResetExpiresAt");
  if (!user || user.status !== "ACTIVE" || user.role !== "SUPER_ADMIN") {
    throw AppError.badRequest(GENERIC_PROFILE_UPDATE_ERROR, "PROFILE_UPDATE_FAILED");
  }

  if (normalizedEmail !== user.email) {
    const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } }).lean();
    if (existing) {
      throw AppError.badRequest(GENERIC_PROFILE_UPDATE_ERROR, "PROFILE_UPDATE_FAILED");
    }
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
  }

  if (data.phone && phoneDigits(data.phone) !== phoneDigits(user.phone ?? "")) {
    const digits = phoneDigits(data.phone);
    const phonePattern = phoneLookupPattern(data.phone);
    const duplicate = phonePattern
      ? await User.exists({ phone: { $regex: phonePattern }, _id: { $ne: user._id } })
      : null;
    if (digits.length < 7 || digits.length > 20 || duplicate) {
      throw AppError.badRequest(GENERIC_PROFILE_UPDATE_ERROR, "PROFILE_UPDATE_FAILED");
    }
  }

  if (data.newPassword) {
    const { valid } = await verifyPasswordAndGetMigrationHash(data.currentPassword ?? "", user.passwordHash);
    if (!valid) {
      throw AppError.badRequest(GENERIC_PROFILE_UPDATE_ERROR, "PROFILE_UPDATE_FAILED");
    }
    user.passwordHash = await hashPassword(data.newPassword);
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    user.mustChangePassword = false;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
  }

  user.name = data.name;
  user.email = normalizedEmail;
  user.phone = data.phone || undefined;
  await user.save();

  const tokens = data.newPassword ? buildTokens(user) : null;
  if (tokens) {
    disconnectUserSessions(String(user._id));
    res.cookie("accessToken", tokens.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
  }

  await recordAudit({
    userId: String(user._id),
    projectId: user.projectId ? String(user.projectId) : null,
    action: "PROFILE_UPDATED",
    entityType: "User",
    entityId: user._id as never,
    metadata: {
      email: user.email,
      phoneUpdated: Boolean(user.phone),
      passwordChanged: Boolean(data.newPassword),
    },
  });

  res.json({ user: serializeAuthUser(user), ...(tokens ? { accessToken: tokens.accessToken } : {}) });
});
