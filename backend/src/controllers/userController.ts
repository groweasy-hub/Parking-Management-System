import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { User } from "../models";
import { ROLES } from "../types/enums";
import { ensureProjectAccess } from "../middleware/auth";
import { recordAudit } from "../services/auditService";
import { hashPassword } from "../utils/password";
import { sanitizeEmail, sanitizeHumanName, sanitizePassword, sanitizePhone } from "../utils/sanitize";

const GENERIC_REGISTRATION_ERROR = "Unable to complete registration.";

export const createUserSchema = z.object({
  name: z.preprocess(
    (value) => (typeof value === "string" ? sanitizeHumanName(value) : value),
    z.string().min(2).max(80)
  ),
  email: z.preprocess(
    (value) => (typeof value === "string" ? sanitizeEmail(value) : value),
    z.string().min(5).max(254).email()
  ),
  phone: z.preprocess(
    (value) => (typeof value === "string" ? sanitizePhone(value) : value),
    z.string().max(25).optional()
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

const PROJECT_ADMIN_CREATABLE_ROLES = ["GATEKEEPER", "VIEWER"];

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
      throw AppError.forbidden("Project admins can only create gate or viewer users.");
    }
    data.projectId = requester.projectId;
  }

  if (data.role !== "SUPER_ADMIN" && !data.projectId) {
    throw AppError.badRequest("projectId is required for this role.");
  }
  if (data.projectId) ensureProjectAccess(requester, data.projectId);

  const existing = await User.findOne({ email: data.email.toLowerCase() }).lean();
  if (existing) throw AppError.conflict(GENERIC_REGISTRATION_ERROR, "REGISTRATION_FAILED");

  const passwordHash = await hashPassword(data.password);
  const user = await User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    phone: data.phone,
    passwordHash,
    role: data.role,
    customRoleLabel: data.customRoleLabel,
    mustChangePassword: data.role === "GATEKEEPER",
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
  const existing = await User.findById(req.params.id);
  if (!existing) throw AppError.notFound("Unable to update user.", "USER_UPDATE_FAILED");
  if (existing.projectId) ensureProjectAccess(requester, String(existing.projectId));
  else if (requester.role !== "SUPER_ADMIN") throw AppError.forbidden();

  const data = req.body as z.infer<typeof updateUserSchema>;
  if (data.name !== undefined) existing.name = data.name;
  if (data.phone !== undefined) existing.phone = data.phone;
  if (data.customRoleLabel !== undefined) existing.customRoleLabel = data.customRoleLabel;
  if (data.status !== undefined) existing.status = data.status;
  if (data.password) {
    existing.passwordHash = await hashPassword(data.password);
    existing.mustChangePassword = existing.role === "GATEKEEPER";
  }

  await existing.save();

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
