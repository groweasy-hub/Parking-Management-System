import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  statusCode: 401,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Incorrect email or password", code: "INVALID_CREDENTIALS" } },
});

export const gateOperationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many requests. Please slow down.", code: "RATE_LIMITED" } },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
