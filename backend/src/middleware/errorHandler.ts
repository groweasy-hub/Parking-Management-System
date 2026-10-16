import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { isProduction } from "../config/env";
import { Error as MongooseError } from "mongoose";
import { MulterError } from "multer";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
  }
  if (err instanceof MongooseError.CastError || err instanceof MongooseError.ValidationError) {
    return res.status(400).json({ error: { message: "Please check the supplied details and try again.", code: "VALIDATION_ERROR" } });
  }
  if (err instanceof MulterError) {
    return res.status(400).json({ error: {
      message: err.code === "LIMIT_FILE_SIZE" ? "Logo files must be 2 MB or smaller." : "Unable to upload this file.",
      code: "INVALID_UPLOAD",
    } });
  }
  if (err instanceof SyntaxError && "status" in err && err.status === 400) {
    return res.status(400).json({ error: { message: "Invalid JSON request.", code: "INVALID_JSON" } });
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
