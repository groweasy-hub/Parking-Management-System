import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { Floor, Company, ParkingAllocation, Occupancy } from "../models";
import { ensureProjectAccess } from "../middleware/auth";
import { computeStatus } from "../services/availabilityService";

function requireProjectId(req: Request): string {
  const projectId = req.query.projectId as string | undefined;
  if (!projectId) throw AppError.badRequest("projectId query param is required");
  ensureProjectAccess(req.user!, projectId);
  return projectId;
}

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const projectId = requireProjectId(req);

  const occupancies = await Occupancy.find({ projectId }).lean();
  const totalCapacity = occupancies.reduce((sum, o) => sum + o.capacity, 0);
  const totalOccupied = occupancies.reduce((sum, o) => sum + o.occupied, 0);

  res.json({
    totalCapacity,
    totalOccupied,
    totalAvailable: totalCapacity - totalOccupied,
    activeVehicles: totalOccupied,
  });
});

export const getFloorDashboard = asyncHandler(async (req: Request, res: Response) => {
  const projectId = requireProjectId(req);

  const floors = await Floor.find({ projectId }).sort({ displayOrder: 1 }).lean();
  const allocations = await ParkingAllocation.find({ projectId, status: "ACTIVE" }).lean();
  const occupancies = await Occupancy.find({ projectId }).lean();
  const occMap = new Map(occupancies.map((o) => [String(o.allocationId), o]));

  const floorData = floors.map((floor) => {
    const floorAllocations = allocations.filter((a) => String(a.floorId) === String(floor._id));
    const byVehicleType = floorAllocations.map((a) => {
      const occ = occMap.get(String(a._id));
      const capacity = occ?.capacity ?? a.capacity;
      const occupied = occ?.occupied ?? 0;
      return {
        allocationId: String(a._id),
        vehicleType: a.vehicleType,
        capacity,
        occupied,
        available: capacity - occupied,
        status: computeStatus(capacity, occupied),
      };
    });
    return {
      floorId: String(floor._id),
      name: floor.name,
      code: floor.code,
      status: floor.status,
      vehicleTypes: byVehicleType,
    };
  });

  res.json({ floors: floorData });
});

export const getCompanyDashboard = asyncHandler(async (req: Request, res: Response) => {
  const projectId = requireProjectId(req);
  const companyId = req.query.companyId as string | undefined;
  if (!companyId) throw AppError.badRequest("companyId query param is required");

  const company = await Company.findOne({ _id: companyId, projectId }).lean();
  if (!company) throw AppError.notFound("Company not found.");

  const allocations = await ParkingAllocation.find({
    projectId,
    companyId,
    status: "ACTIVE",
  }).lean();
  const floors = await Floor.find({ _id: { $in: allocations.map((a) => a.floorId) } }).lean();
  const floorMap = new Map(floors.map((f) => [String(f._id), f]));
  const occupancies = await Occupancy.find({
    allocationId: { $in: allocations.map((a) => a._id) },
  }).lean();
  const occMap = new Map(occupancies.map((o) => [String(o.allocationId), o]));

  const breakdown = allocations.map((a) => {
    const occ = occMap.get(String(a._id));
    const capacity = occ?.capacity ?? a.capacity;
    const occupied = occ?.occupied ?? 0;
    const floor = floorMap.get(String(a.floorId));
    return {
      allocationId: String(a._id),
      floorId: String(a.floorId),
      floorName: floor?.name ?? "Unknown",
      floorCode: floor?.code ?? "?",
      vehicleType: a.vehicleType,
      capacity,
      occupied,
      available: capacity - occupied,
      status: computeStatus(capacity, occupied),
    };
  });

  res.json({
    company: { id: company._id, name: company.name, logoUrl: company.logoUrl },
    allocations: breakdown,
  });
});
