import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { User } from "../models";
import { hashPassword } from "../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { env, isProduction } from "../config/env";
import { recordAudit } from "../services/auditService";
import { sanitizeEmail, sanitizePassword } from "../utils/sanitize";
import {
  applyProgressiveDelay,
  clearFailedLogin,
  isAccountLocked,
  recordFailedLogin,
  verifyPasswordAndGetMigrationHash,
} from "../services/authSecurityService";

const GENERIC_LOGIN_ERROR = "Incorrect email or password";
const GENERIC_PASSWORD_CHANGE_ERROR = "Unable to change password.";

export const loginSchema = z.object({
  email: z.preprocess(
    (value) => (typeof value === "string" ? sanitizeEmail(value) : value),
    z.string().min(5).max(254).email()
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

// In production the frontend (Vercel) and backend typically live on
// different registrable domains, so cookies must be SameSite=None+Secure to
// survive the cross-site fetch; in local dev http://localhost keeps Lax so
// it also works without HTTPS.
const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
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
}) {
  const accessToken = signAccessToken({
    sub: String(user._id),
    role: user.role as never,
    projectId: user.projectId ? String(user.projectId) : null,
    gateId: user.gateId ? String(user.gateId) : null,
  });
  const refreshToken = signRefreshToken(String(user._id));
  return { accessToken, refreshToken };
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const normalizedEmail = email.toLowerCase();

  if (isAccountLocked(normalizedEmail)) {
    await applyProgressiveDelay(normalizedEmail);
    throw AppError.unauthorized(GENERIC_LOGIN_ERROR, "INVALID_CREDENTIALS");
  }

  const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");
  if (!user || user.status !== "ACTIVE") {
    await recordFailedLogin(normalizedEmail);
    throw AppError.unauthorized(GENERIC_LOGIN_ERROR, "INVALID_CREDENTIALS");
  }

  const { valid, migrationHash } = await verifyPasswordAndGetMigrationHash(password, user.passwordHash);
  if (!valid) {
    await recordFailedLogin(normalizedEmail);
    throw AppError.unauthorized(GENERIC_LOGIN_ERROR, "INVALID_CREDENTIALS");
  }

  clearFailedLogin(normalizedEmail);
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
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      projectId: user.projectId,
      gateId: user.gateId,
    },
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

  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw AppError.unauthorized("Session expired. Please log in again.", "TOKEN_INVALID");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== "ACTIVE") throw AppError.unauthorized();

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
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      projectId: user.projectId,
      gateId: user.gateId,
    },
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const { oldPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;

  const user = await User.findById(req.user.id).select("+passwordHash");
  if (!user || user.status !== "ACTIVE") throw AppError.unauthorized();

  const { valid } = await verifyPasswordAndGetMigrationHash(oldPassword, user.passwordHash);
  if (!valid) {
    throw AppError.badRequest(GENERIC_PASSWORD_CHANGE_ERROR, "PASSWORD_CHANGE_FAILED");
  }

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();

  await recordAudit({
    userId: String(user._id),
    projectId: user.projectId ? String(user.projectId) : null,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user._id as never,
  });

  res.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      projectId: user.projectId,
      gateId: user.gateId,
    },
  });
});
