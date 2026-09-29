import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { Gate } from "../models";
import { GATE_TYPES } from "../types/enums";
import { ensureProjectAccess } from "../middleware/auth";
import { recordAudit } from "../services/auditService";

export const createGateSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(GATE_TYPES),
});

export const updateGateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const listGates = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  if (!projectId) throw AppError.badRequest("projectId query param is required");
  ensureProjectAccess(req.user!, projectId);

  const filter: Record<string, unknown> = { projectId };
  if (req.query.type) filter.type = req.query.type;

  const gates = await Gate.find(filter).sort({ name: 1 }).lean();
  res.json({ gates });
});

export const createGate = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof createGateSchema>;
  ensureProjectAccess(req.user!, data.projectId);

  const gate = await Gate.create({
    projectId: data.projectId,
    name: data.name,
    type: data.type,
    status: "ACTIVE",
  });

  await recordAudit({
    userId: req.user!.id,
    projectId: data.projectId,
    action: "GATE_CREATED",
    entityType: "Gate",
    entityId: gate._id as never,
    metadata: { name: gate.name, type: gate.type },
  });

  res.status(201).json({ gate });
});

export const updateGate = asyncHandler(async (req: Request, res: Response) => {
  const existing = await Gate.findById(req.params.id);
  if (!existing) throw AppError.notFound("Gate not found.");
  ensureProjectAccess(req.user!, String(existing.projectId));

  const data = req.body as z.infer<typeof updateGateSchema>;
  Object.assign(existing, data);
  await existing.save();

  await recordAudit({
    userId: req.user!.id,
    projectId: String(existing.projectId),
    action: "GATE_UPDATED",
    entityType: "Gate",
    entityId: existing._id as never,
    metadata: data,
  });

  res.json({ gate: existing });
});
