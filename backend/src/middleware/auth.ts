import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { verifyAccessToken } from "../utils/jwt";
import { Role } from "../types/enums";
import { User } from "../models";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * Authenticates the request from the access-token cookie (or, as a
 * fallback for non-browser clients, an Authorization: Bearer header).
 * Role/project/gate claims always come from the verified token — never
 * from request body/query — so a client cannot escalate its own access.
 */
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const cookieToken = req.cookies?.accessToken;
  const header = req.headers.authorization;
  const headerToken = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const tokens = [cookieToken, headerToken].filter(Boolean) as string[];

  if (tokens.length === 0) {
    return next(AppError.unauthorized());
  }

  for (const token of tokens) {
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      continue;
    }
    const user = await User.findById(payload.sub).lean();
    if (!user || user.status !== "ACTIVE" || (user.sessionVersion ?? 0) !== (payload.sessionVersion ?? 0)) continue;
    const path = req.originalUrl.split("?")[0].replace(/\/$/, "");
    if (user.mustChangePassword && !["/api/auth/me", "/api/auth/change-password", "/api/auth/logout", "/api/projects"].includes(path)) {
      throw AppError.forbidden("Please change your temporary password before continuing.", "PASSWORD_CHANGE_REQUIRED");
    }
    req.user = {
      id: String(user._id),
      role: user.role,
      projectId: user.projectId ? String(user.projectId) : null,
      gateId: user.gateId ? String(user.gateId) : null,
    };
    return next();
  }

  next(AppError.unauthorized("Session expired. Please log in again.", "TOKEN_INVALID"));
});

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden());
    }
    next();
  };
}

/**
 * Verifies the authenticated user may act on the given projectId.
 * SUPER_ADMIN bypasses project scoping; every other role must have been
 * assigned to that exact project.
 */
export function requireProjectAccess(getProjectId: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (req.user.role === "SUPER_ADMIN") return next();

    const targetProjectId = getProjectId(req);
    if (!targetProjectId) return next(AppError.badRequest("projectId is required"));
    if (req.user.projectId !== targetProjectId) {
      return next(AppError.forbidden("You do not have access to this project"));
    }
    next();
  };
}

/**
 * Non-middleware variant for controllers that only know the target
 * projectId after a database lookup (e.g. editing a floor by id).
 */
export function ensureProjectAccess(
  user: { role: Role; projectId: string | null },
  projectId: string
): void {
  if (user.role === "SUPER_ADMIN") return;
  if (user.projectId !== projectId) {
    throw AppError.forbidden("You do not have access to this project");
  }
}
