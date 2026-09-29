import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";
import { AppError } from "../utils/AppError";

type Target = "body" | "query" | "params";

type ValidateOptions = {
  genericMessage?: string;
  genericCode?: string;
  logLabel?: string;
};

export function validate(schema: ZodTypeAny, target: Target = "body", options: ValidateOptions = {}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      if (options.logLabel) {
        console.warn("[validation] request rejected", {
          label: options.logLabel,
          method: req.method,
          path: req.originalUrl,
          issues: result.error.issues.map((issue) => ({
            field: issue.path.join(".") || target,
            code: issue.code,
            message: issue.message,
          })),
        });
      }

      if (options.genericMessage) {
        return next(
          AppError.badRequest(
            options.genericMessage,
            options.genericCode ?? "VALIDATION_ERROR"
          )
        );
      }

      const message = result.error.issues
        .map((i) => `${i.path.join(".") || target}: ${i.message}`)
        .join("; ");
      return next(AppError.badRequest(message, "VALIDATION_ERROR"));
    }
    req[target] = result.data;
    next();
  };
}
