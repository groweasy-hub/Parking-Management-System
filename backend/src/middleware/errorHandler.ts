import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { isProduction } from "../config/env";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
  }

  // MongoDB duplicate key error
  if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
    return res.status(409).json({
      error: { message: "A record with these details already exists.", code: "DUPLICATE" },
    });
  }

  console.error("[unhandled error]", err);
  return res.status(500).json({
    error: {
      message: "Unable to complete the request. Please try again.",
      code: "INTERNAL_ERROR",
      ...(isProduction ? {} : { detail: err instanceof Error ? err.message : String(err) }),
    },
  });
}
