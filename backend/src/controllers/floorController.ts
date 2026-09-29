import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { Floor, ParkingAllocation } from "../models";
import { ensureProjectAccess } from "../middleware/auth";
import { recordAudit } from "../services/auditService";

export const createFloorSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  displayOrder: z.number().int().optional(),
});

export const updateFloorSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).max(10).optional(),
  displayOrder: z.number().int().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const reorderFloorsSchema = z.object({
  projectId: z.string().min(1),
  order: z.array(z.object({ floorId: z.string().min(1), displayOrder: z.number().int() })),
});

export const listFloors = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  if (!projectId) throw AppError.badRequest("projectId query param is required");
  ensureProjectAccess(req.user!, projectId);
  const floors = await Floor.find({ projectId }).sort({ displayOrder: 1 }).lean();
  res.json({ floors });
});

export const createFloor = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof createFloorSchema>;
  ensureProjectAccess(req.user!, data.projectId);

  const displayOrder =
    data.displayOrder ?? (await Floor.countDocuments({ projectId: data.projectId }));

  const floor = await Floor.create({
    projectId: data.projectId,
    name: data.name,
    code: data.code.toUpperCase(),
    displayOrder,
    status: "ACTIVE",
  });

  await recordAudit({
    userId: req.user!.id,
    projectId: data.projectId,
    action: "FLOOR_CREATED",
    entityType: "Floor",
    entityId: floor._id as never,
    metadata: { name: floor.name, code: floor.code },
  });

  res.status(201).json({ floor });
});

export const updateFloor = asyncHandler(async (req: Request, res: Response) => {
  const existing = await Floor.findById(req.params.id);
  if (!existing) throw AppError.notFound("Floor not found.");
  ensureProjectAccess(req.user!, String(existing.projectId));

  const data = req.body as z.infer<typeof updateFloorSchema>;
  if (data.code) data.code = data.code.toUpperCase();
  Object.assign(existing, data);
  await existing.save();

  await recordAudit({
    userId: req.user!.id,
    projectId: String(existing.projectId),
    action: "FLOOR_UPDATED",
    entityType: "Floor",
    entityId: existing._id as never,
    metadata: data,
  });

  res.json({ floor: existing });
});

export const deleteFloor = asyncHandler(async (req: Request, res: Response) => {
  const existing = await Floor.findById(req.params.id);
  if (!existing) throw AppError.notFound("Floor not found.");
  ensureProjectAccess(req.user!, String(existing.projectId));

  const allocationCount = await ParkingAllocation.countDocuments({ floorId: existing._id });
  if (allocationCount > 0) {
    throw AppError.conflict(
      "This floor has parking allocations. Remove its allocations before deleting it.",
      "FLOOR_HAS_ALLOCATIONS"
    );
  }

  await existing.deleteOne();

  await recordAudit({
    userId: req.user!.id,
    projectId: String(existing.projectId),
    action: "FLOOR_DELETED",
    entityType: "Floor",
    entityId: existing._id as never,
    metadata: { name: existing.name, code: existing.code },
  });

  res.json({ success: true });
});

export const reorderFloors = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof reorderFloorsSchema>;
  ensureProjectAccess(req.user!, data.projectId);

  await Promise.all(
    data.order.map((item) =>
      Floor.updateOne(
        { _id: item.floorId, projectId: data.projectId },
        { $set: { displayOrder: item.displayOrder } }
      )
    )
  );

  await recordAudit({
    userId: req.user!.id,
    projectId: data.projectId,
    action: "FLOORS_REORDERED",
    entityType: "Floor",
    metadata: { order: data.order },
  });

  const floors = await Floor.find({ projectId: data.projectId }).sort({ displayOrder: 1 }).lean();
  res.json({ floors });
});
