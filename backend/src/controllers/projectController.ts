import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import {
  Project,
  Floor,
  Company,
  ParkingAllocation,
  ParkingSession,
  Occupancy,
  Gate,
  User,
} from "../models";
import { recordAudit } from "../services/auditService";
import { generateUniqueCode } from "../utils/codeGenerator";
import { runInTransaction } from "../utils/transaction";

export const createProjectSchema = z.object({
  name: z.string().min(2),
  address: z.string().optional(),
  // Total building floors (offices etc.), excluding parking floors.
  totalFloors: z.number().int().min(0).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  totalFloors: z.number().int().min(0).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const listProjects = asyncHandler(async (req: Request, res: Response) => {
  if (req.user!.role === "SUPER_ADMIN") {
    const projects = await Project.find().sort({ createdAt: -1 }).lean();
    return res.json({ projects });
  }
  if (!req.user!.projectId) return res.json({ projects: [] });
  const project = await Project.findById(req.user!.projectId).lean();
  res.json({ projects: project ? [project] : [] });
});

export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await Project.findById(req.params.id).lean();
  if (!project) throw AppError.notFound("Project not found.");
  res.json({ project });
});

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof createProjectSchema>;
  const code = await generateUniqueCode(data.name, async (candidate) => {
    const existing = await Project.findOne({ code: candidate }).lean();
    return Boolean(existing);
  });
  const project = await Project.create({
    name: data.name,
    code,
    address: data.address,
    totalFloors: data.totalFloors,
    status: "ACTIVE",
  });
  await recordAudit({
    userId: req.user!.id,
    projectId: String(project._id),
    action: "PROJECT_CREATED",
    entityType: "Project",
    entityId: project._id as never,
    metadata: { name: project.name, code: project.code },
  });
  res.status(201).json({ project });
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof updateProjectSchema>;
  const project = await Project.findByIdAndUpdate(req.params.id, data, { new: true });
  if (!project) throw AppError.notFound("Project not found.");
  await recordAudit({
    userId: req.user!.id,
    projectId: String(project._id),
    action: "PROJECT_UPDATED",
    entityType: "Project",
    entityId: project._id as never,
    metadata: data,
  });
  res.json({ project });
});

/**
 * Permanently deletes a project and every record scoped to it (floors,
 * companies, allocations, occupancy counters, parking sessions, gates and
 * project-scoped users). This is intentionally a hard delete, not a status
 * flip — the caller is expected to have confirmed this out-of-band (the
 * frontend requires typing the project's code back). Audit log entries for
 * the project are kept as an immutable historical record; a final
 * PROJECT_DELETED entry is written before the cascade runs.
 */
export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw AppError.notFound("Project not found.");

  const projectId = project._id;

  await runInTransaction(async (session) => {
    await recordAudit(
      {
        userId: req.user!.id,
        projectId: String(projectId),
        action: "PROJECT_DELETED",
        entityType: "Project",
        entityId: projectId as never,
        metadata: { name: project.name, code: project.code },
      },
      session
    );

    await Promise.all([
      Occupancy.deleteMany({ projectId }, { session }),
      ParkingSession.deleteMany({ projectId }, { session }),
      ParkingAllocation.deleteMany({ projectId }, { session }),
      Floor.deleteMany({ projectId }, { session }),
      Company.deleteMany({ projectId }, { session }),
      Gate.deleteMany({ projectId }, { session }),
      User.deleteMany({ projectId }, { session }),
    ]);

    await Project.deleteOne({ _id: projectId }, { session });
  });

  res.json({ success: true });
});
