export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, code = "BAD_REQUEST") {
    return new AppError(message, 400, code);
  }
  static unauthorized(message = "Authentication required", code = "UNAUTHORIZED") {
    return new AppError(message, 401, code);
  }
  static forbidden(message = "You do not have permission to perform this action", code = "FORBIDDEN") {
    return new AppError(message, 403, code);
  }
  static notFound(message = "Resource not found", code = "NOT_FOUND") {
    return new AppError(message, 404, code);
  }
  static conflict(message: string, code = "CONFLICT") {
    return new AppError(message, 409, code);
  }
  static internal(message = "Something went wrong. Please try again.", code = "INTERNAL_ERROR") {
    return new AppError(message, 500, code);
  }
}
