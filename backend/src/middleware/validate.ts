import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";
import { AppError } from "../utils/AppError";

type Target = "body" | "query" | "params";

export function validate(schema: ZodTypeAny, target: Target = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join(".") || target}: ${i.message}`)
        .join("; ");
      return next(AppError.badRequest(message, "VALIDATION_ERROR"));
    }
    req[target] = result.data;
    next();
  };
}
