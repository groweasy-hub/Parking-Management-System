import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { Project, User } from "../models";
import { disconnectUserSessions } from "../realtime/socketServer";
import { isGateOperator, ROLES } from "../types/enums";
import { ensureProjectAccess } from "../middleware/auth";
import { recordAudit } from "../services/auditService";
import { hashPassword } from "../utils/password";
import { phoneDigits, phoneLookupPattern, sanitizeEmail, sanitizeHumanName, sanitizePassword, sanitizePhone } from "../utils/sanitize";

const GENERIC_REGISTRATION_ERROR = "Unable to complete registration.";

export const createUserSchema = z.object({
  name: z.preprocess(
    (value) => (typeof value === "string" ? sanitizeHumanName(value) : value),
    z.string().min(2).max(80)
  ),
  email: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      return sanitizeEmail(value) || undefined;
    },
    z.string().min(5).max(254).email().optional()
  ),
  phone: z.preprocess(
    (value) => (typeof value === "string" ? sanitizePhone(value) : value),
    z.string().min(1).max(25).refine((value) => phoneDigits(value).length >= 7 && phoneDigits(value).length <= 20, "Enter a valid mobile number.")
  ),
  password: z.preprocess(
    (value) => (typeof value === "string" ? sanitizePassword(value) : value),
    z.string().min(8).max(128)
  ),
  role: z.enum(ROLES),
  customRoleLabel: z.preprocess(
    (value) => (typeof value === "string" ? sanitizeHumanName(value) : value),
    z.string().max(60).optional()
  ),
  projectId: z.string().nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.preprocess(
    (value) => (typeof value === "string" ? sanitizeHumanName(value) : value),
    z.string().min(2).max(80).optional()
  ),
  phone: z.preprocess(
    (value) => (typeof value === "string" ? sanitizePhone(value) : value),
    z.string().max(25).optional()
  ),
  customRoleLabel: z.preprocess(
    (value) => (typeof value === "string" ? sanitizeHumanName(value) : value),
    z.string().max(60).optional()
  ),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  password: z.preprocess(
    (value) => (typeof value === "string" ? sanitizePassword(value) : value),
    z.string().min(8).max(128).optional()
  ),
});

const PROJECT_ADMIN_CREATABLE_ROLES = ["GATEKEEPER", "SECURITY_SUPERVISOR", "VIEWER"];

async function ensureUniqueLoginPhone(phone: string | undefined, excludeUserId?: string) {
  if (!phone) return;
  const digits = phoneDigits(phone);
  if (digits.length < 7 || digits.length > 20) {
    throw AppError.badRequest("Enter a valid mobile number with 7 to 20 digits.", "INVALID_PHONE");
  }
  const pattern = phoneLookupPattern(phone);
  if (!pattern) return;
  const filter: Record<string, unknown> = { phone: { $regex: pattern } };
  if (excludeUserId) filter._id = { $ne: excludeUserId };
  if (await User.exists(filter)) {
    throw AppError.conflict("This mobile number is already assigned to another account.", "PHONE_ALREADY_IN_USE");
  }
}

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const requester = req.user!;
  const filter: Record<string, unknown> = {};

  if (requester.role === "SUPER_ADMIN") {
    if (req.query.projectId) filter.projectId = req.query.projectId;
  } else {
    filter.projectId = requester.projectId;
  }
  if (req.query.role) filter.role = req.query.role;

  const users = await User.find(filter).sort({ createdAt: -1 }).lean();
  res.json({ users });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const requester = req.user!;
  const data = req.body as z.infer<typeof createUserSchema>;

  if (requester.role === "PROJECT_ADMIN") {
    if (!PROJECT_ADMIN_CREATABLE_ROLES.includes(data.role)) {
      throw AppError.forbidden("Project admins can only create gate, security supervisor, or viewer users.");
    }
    data.projectId = requester.projectId;
  }

  if (data.role !== "SUPER_ADMIN" && !data.projectId) {
    throw AppError.badRequest("projectId is required for this role.");
  }
  if (data.projectId) ensureProjectAccess(requester, data.projectId);
  if (data.role !== "SUPER_ADMIN" && !await Project.exists({ _id: data.projectId, status: "ACTIVE" })) {
    throw AppError.badRequest("Please select an active project.");
  }
  await ensureUniqueLoginPhone(data.phone);

  const existing = data.email ? await User.findOne({ email: data.email.toLowerCase() }).lean() : null;
  if (existing) throw AppError.conflict(GENERIC_REGISTRATION_ERROR, "REGISTRATION_FAILED");

  const passwordHash = await hashPassword(data.password);
  const user = await User.create({
    name: data.name,
    email: data.email?.toLowerCase(),
    phone: data.phone,
    passwordHash,
    role: data.role,
    customRoleLabel: data.customRoleLabel,
    mustChangePassword: isGateOperator(data.role),
    projectId: data.role === "SUPER_ADMIN" ? null : data.projectId,
    gateId: null,
    status: "ACTIVE",
  });

  await recordAudit({
    userId: requester.id,
    projectId: data.projectId ?? null,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user._id as never,
    metadata: { email: user.email, role: user.role },
  });

  res.status(201).json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      customRoleLabel: user.customRoleLabel,
      mustChangePassword: user.mustChangePassword,
      projectId: user.projectId,
      gateId: null,
      status: user.status,
    },
  });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const requester = req.user!;
  const existing = await User.findById(req.params.id).select("+passwordResetTokenHash +passwordResetExpiresAt");
  if (!existing) throw AppError.notFound("Unable to update user.", "USER_UPDATE_FAILED");
  if (existing.projectId) ensureProjectAccess(requester, String(existing.projectId));
  else if (requester.role !== "SUPER_ADMIN") throw AppError.forbidden();

  const data = req.body as z.infer<typeof updateUserSchema>;
  if (requester.role === "PROJECT_ADMIN" && !PROJECT_ADMIN_CREATABLE_ROLES.includes(existing.role)) {
    throw AppError.forbidden("Project admins can only update gate, security supervisor, or viewer users.");
  }
  if (data.phone !== undefined && phoneDigits(data.phone) !== phoneDigits(existing.phone ?? "")) {
    await ensureUniqueLoginPhone(data.phone, String(existing._id));
  }
  if (requester.id === String(existing._id) && data.status === "INACTIVE") {
    throw AppError.badRequest("You cannot deactivate your own account.");
  }
  if (data.name !== undefined) existing.name = data.name;
  if (data.phone !== undefined) existing.phone = data.phone;
  if (data.customRoleLabel !== undefined) existing.customRoleLabel = data.customRoleLabel;
  if (data.status !== undefined) existing.status = data.status;
  if (data.password) {
    existing.passwordHash = await hashPassword(data.password);
    existing.mustChangePassword = isGateOperator(existing.role);
    existing.passwordResetTokenHash = undefined;
    existing.passwordResetExpiresAt = undefined;
  }
  if (data.password || (data.status && existing.isModified("status"))) {
    existing.sessionVersion = (existing.sessionVersion ?? 0) + 1;
  }

  await existing.save();
  if (data.password || data.status === "INACTIVE") disconnectUserSessions(String(existing._id));

  await recordAudit({
    userId: requester.id,
    projectId: existing.projectId ? String(existing.projectId) : null,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: existing._id as never,
    metadata: { ...data, password: data.password ? "[redacted]" : undefined },
  });

  res.json({
    user: {
      id: existing._id,
      name: existing.name,
      email: existing.email,
      role: existing.role,
      customRoleLabel: existing.customRoleLabel,
      mustChangePassword: existing.mustChangePassword,
      projectId: existing.projectId,
      gateId: existing.gateId,
      status: existing.status,
    },
  });
});
