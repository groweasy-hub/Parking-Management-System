import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { verifyAccessToken } from "../utils/jwt";
import { Role } from "../types/enums";

/**
 * Authenticates the request from the access-token cookie (or, as a
 * fallback for non-browser clients, an Authorization: Bearer header).
 * Role/project/gate claims always come from the verified token — never
 * from request body/query — so a client cannot escalate its own access.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.accessToken;
  const header = req.headers.authorization;
  const headerToken = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const tokens = [cookieToken, headerToken].filter(Boolean) as string[];

  if (tokens.length === 0) {
    return next(AppError.unauthorized());
  }

  for (const token of tokens) {
    try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      projectId: payload.projectId,
      gateId: payload.gateId,
    };
      return next();
    } catch {
      // Try the next available credential before failing the request.
    }
  }

  next(AppError.unauthorized("Session expired. Please log in again.", "TOKEN_INVALID"));
}

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
