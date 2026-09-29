import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { User, Gate } from "../models";
import { ROLES } from "../types/enums";
import { ensureProjectAccess } from "../middleware/auth";
import { recordAudit } from "../services/auditService";
import { hashPassword } from "../utils/password";

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(ROLES),
  projectId: z.string().nullable().optional(),
  gateId: z.string().nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  gateId: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  password: z.string().min(8).optional(),
});

const PROJECT_ADMIN_CREATABLE_ROLES = ["ENTRY_GATEMAN", "EXIT_GATEMAN", "VIEWER"];

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const requester = req.user!;
  const filter: Record<string, unknown> = {};

  if (requester.role === "SUPER_ADMIN") {
    if (req.query.projectId) filter.projectId = req.query.projectId;
  } else {
    filter.projectId = requester.projectId;
  }
  if (req.query.role) filter.role = req.query.role;
  if (req.query.gateId) filter.gateId = req.query.gateId;

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

  if (data.gateId) {
    const gate = await Gate.findOne({ _id: data.gateId, projectId: data.projectId }).lean();
    if (!gate) throw AppError.badRequest("Gate not found for this project.");
  }

  const existing = await User.findOne({ email: data.email.toLowerCase() }).lean();
  if (existing) throw AppError.conflict("A user with this email already exists.");

  const passwordHash = await hashPassword(data.password);
  const user = await User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    phone: data.phone,
    passwordHash,
    role: data.role,
    projectId: data.role === "SUPER_ADMIN" ? null : data.projectId,
    gateId: data.gateId ?? null,
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
      projectId: user.projectId,
      gateId: user.gateId,
      status: user.status,
    },
  });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const requester = req.user!;
  const existing = await User.findById(req.params.id);
  if (!existing) throw AppError.notFound("User not found.");
  if (existing.projectId) ensureProjectAccess(requester, String(existing.projectId));
  else if (requester.role !== "SUPER_ADMIN") throw AppError.forbidden();

  const data = req.body as z.infer<typeof updateUserSchema>;
  if (data.gateId !== undefined) existing.gateId = data.gateId as never;
  if (data.name !== undefined) existing.name = data.name;
  if (data.phone !== undefined) existing.phone = data.phone;
  if (data.status !== undefined) existing.status = data.status;
  if (data.password) existing.passwordHash = await hashPassword(data.password);

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
      projectId: existing.projectId,
      gateId: existing.gateId,
      status: existing.status,
    },
  });
});
