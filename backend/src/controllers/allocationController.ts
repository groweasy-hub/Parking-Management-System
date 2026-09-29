import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { Floor, ParkingAllocation, Occupancy, ParkingSession } from "../models";
import { ensureProjectAccess } from "../middleware/auth";
import { recordAudit } from "../services/auditService";
import { runInTransaction } from "../utils/transaction";

const ALLOCATABLE_VEHICLE_TYPES = ["CAR", "BIKE"] as const;

export const createAllocationSchema = z.object({
  projectId: z.string().min(1),
  companyId: z.string().min(1),
  floorId: z.string().min(1),
  vehicleType: z.enum(ALLOCATABLE_VEHICLE_TYPES),
  capacity: z.number().int().min(0),
  preferred: z.boolean().optional(),
});

export const updateAllocationSchema = z.object({
  capacity: z.number().int().min(0).optional(),
  preferred: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

function capacityFieldFor(vehicleType: string) {
  if (vehicleType === "CAR") return "carCapacity";
  return "bikeCapacity";
}

async function ensureFloorCapacityAvailable(args: {
  projectId: string;
  floorId: string;
  vehicleType: string;
  requestedCapacity: number;
  excludeAllocationId?: string;
}) {
  const floor = await Floor.findOne({ _id: args.floorId, projectId: args.projectId }).lean();
  if (!floor) throw AppError.notFound("Parking floor not found.");

  const capacityField = capacityFieldFor(args.vehicleType) as "carCapacity" | "bikeCapacity";
  const floorCapacity = floor[capacityField] ?? 0;
  const filter: Record<string, unknown> = {
    projectId: args.projectId,
    floorId: args.floorId,
    vehicleType: args.vehicleType,
    status: "ACTIVE",
  };
  if (args.excludeAllocationId) filter._id = { $ne: args.excludeAllocationId };

  const existingAllocations = await ParkingAllocation.find(filter).lean();
  const alreadyAllocated = existingAllocations.reduce((sum, allocation) => sum + allocation.capacity, 0);
  if (alreadyAllocated + args.requestedCapacity > floorCapacity) {
    throw AppError.badRequest(
      `Only ${Math.max(0, floorCapacity - alreadyAllocated)} ${args.vehicleType.toLowerCase()} spaces are available on ${floor.code}.`,
      "FLOOR_CAPACITY_EXCEEDED"
    );
  }
}

export const listAllocations = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  if (!projectId) throw AppError.badRequest("projectId query param is required");
  ensureProjectAccess(req.user!, projectId);

  const filter: Record<string, unknown> = { projectId };
  if (req.query.companyId) filter.companyId = req.query.companyId;
  if (req.query.floorId) filter.floorId = req.query.floorId;
  if (req.query.vehicleType) filter.vehicleType = req.query.vehicleType;

  const allocations = await ParkingAllocation.find(filter).lean();
  const occupancies = await Occupancy.find({
    allocationId: { $in: allocations.map((a) => a._id) },
  }).lean();
  const occMap = new Map(occupancies.map((o) => [String(o.allocationId), o]));

  res.json({
    allocations: allocations.map((a) => ({
      ...a,
      occupied: occMap.get(String(a._id))?.occupied ?? 0,
    })),
  });
});

export const createAllocation = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof createAllocationSchema>;
  ensureProjectAccess(req.user!, data.projectId);

  const existing = await ParkingAllocation.findOne({
    projectId: data.projectId,
    companyId: data.companyId,
    floorId: data.floorId,
    vehicleType: data.vehicleType,
  });
  if (existing) {
    throw AppError.conflict(
      "An allocation already exists for this company, floor and vehicle type.",
      "ALLOCATION_EXISTS"
    );
  }

  await ensureFloorCapacityAvailable({
    projectId: data.projectId,
    floorId: data.floorId,
    vehicleType: data.vehicleType,
    requestedCapacity: data.capacity,
  });

  const allocation = await runInTransaction(async (session) => {
    const [created] = await ParkingAllocation.create(
      [
        {
          projectId: data.projectId,
          companyId: data.companyId,
          floorId: data.floorId,
          vehicleType: data.vehicleType,
          capacity: data.capacity,
          preferred: data.preferred ?? false,
          status: "ACTIVE",
        },
      ],
      { session }
    );

    await Occupancy.create(
      [
        {
          projectId: data.projectId,
          allocationId: created._id,
          capacity: data.capacity,
          occupied: 0,
        },
      ],
      { session }
    );

    await recordAudit(
      {
        userId: req.user!.id,
        projectId: data.projectId,
        action: "ALLOCATION_CREATED",
        entityType: "ParkingAllocation",
        entityId: created._id as never,
        metadata: data,
      },
      session
    );

    return created;
  });

  res.status(201).json({ allocation });
});

export const updateAllocation = asyncHandler(async (req: Request, res: Response) => {
  const existing = await ParkingAllocation.findById(req.params.id);
  if (!existing) throw AppError.notFound("Allocation not found.");
  ensureProjectAccess(req.user!, String(existing.projectId));

  const data = req.body as z.infer<typeof updateAllocationSchema>;

  if (data.capacity !== undefined) {
    const activeCount = await ParkingSession.countDocuments({
      allocationId: existing._id,
      status: "ACTIVE",
    });
    if (data.capacity < activeCount) {
      throw AppError.badRequest(
        `Capacity cannot be set below the current occupancy (${activeCount}).`,
        "CAPACITY_BELOW_OCCUPANCY"
      );
    }
    await ensureFloorCapacityAvailable({
      projectId: String(existing.projectId),
      floorId: String(existing.floorId),
      vehicleType: existing.vehicleType,
      requestedCapacity: data.capacity,
      excludeAllocationId: String(existing._id),
    });
  }

  await runInTransaction(async (session) => {
    Object.assign(existing, data);
    await existing.save({ session });

    if (data.capacity !== undefined) {
      await Occupancy.findOneAndUpdate(
        { allocationId: existing._id },
        { $set: { capacity: data.capacity } },
        { session }
      );
    }

    await recordAudit(
      {
        userId: req.user!.id,
        projectId: String(existing.projectId),
        action: "ALLOCATION_UPDATED",
        entityType: "ParkingAllocation",
        entityId: existing._id as never,
        metadata: data,
      },
      session
    );
  });

  res.json({ allocation: existing });
});
