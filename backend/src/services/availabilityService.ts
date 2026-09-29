import { Types } from "mongoose";
import { AvailabilityStatus } from "../types/enums";
import { Occupancy, ParkingAllocation, Floor } from "../models";

// A floor is shown as LIMITED (not simply AVAILABLE) once remaining spaces
// drop to this count or fewer, so gate staff get advance warning of FULL.
export const LIMITED_THRESHOLD = 3;

export function computeStatus(capacity: number, occupied: number): AvailabilityStatus {
  const available = capacity - occupied;
  if (available <= 0) return "FULL";
  if (available <= LIMITED_THRESHOLD) return "LIMITED";
  return "AVAILABLE";
}

export interface AllocationAvailability {
  allocationId: string;
  floorId: string;
  floorName: string;
  floorCode: string;
  vehicleType: string;
  capacity: number;
  occupied: number;
  available: number;
  status: AvailabilityStatus;
  preferred: boolean;
}

/**
 * Returns availability for every ACTIVE allocation a company holds for a
 * given vehicle type, ordered so the preferred floor (if it has capacity)
 * comes first, followed by other floors with availability, then full ones.
 */
export async function getCompanyAvailability(
  projectId: string,
  companyId: string,
  vehicleType: string,
  floorId?: string
): Promise<AllocationAvailability[]> {
  const filter: Record<string, unknown> = {
    projectId: new Types.ObjectId(projectId),
    companyId: new Types.ObjectId(companyId),
    vehicleType,
    status: "ACTIVE",
  };
  if (floorId) filter.floorId = new Types.ObjectId(floorId);

  const allocations = await ParkingAllocation.find(filter).lean();
  if (allocations.length === 0) return [];

  const floorIds = allocations.map((a) => a.floorId);
  const floors = await Floor.find({ _id: { $in: floorIds } }).lean();
  const floorMap = new Map(floors.map((f) => [String(f._id), f]));

  const occupancies = await Occupancy.find({
    allocationId: { $in: allocations.map((a) => a._id) },
  }).lean();
  const occupancyMap = new Map(occupancies.map((o) => [String(o.allocationId), o]));

  const results: AllocationAvailability[] = allocations.map((alloc) => {
    const occ = occupancyMap.get(String(alloc._id));
    const capacity = occ?.capacity ?? alloc.capacity;
    const occupied = occ?.occupied ?? 0;
    const floor = floorMap.get(String(alloc.floorId));
    return {
      allocationId: String(alloc._id),
      floorId: String(alloc.floorId),
      floorName: floor?.name ?? "Unknown floor",
      floorCode: floor?.code ?? "?",
      vehicleType: alloc.vehicleType,
      capacity,
      occupied,
      available: capacity - occupied,
      status: computeStatus(capacity, occupied),
      preferred: alloc.preferred,
    };
  });

  results.sort((a, b) => {
    if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
    if (a.status !== b.status) {
      const rank: Record<AvailabilityStatus, number> = { AVAILABLE: 0, LIMITED: 1, FULL: 2 };
      return rank[a.status] - rank[b.status];
    }
    return b.available - a.available;
  });

  return results;
}

export async function getAllocationAvailability(
  allocationId: string
): Promise<AllocationAvailability | null> {
  const alloc = await ParkingAllocation.findById(allocationId).lean();
  if (!alloc) return null;
  const floor = await Floor.findById(alloc.floorId).lean();
  const occ = await Occupancy.findOne({ allocationId: alloc._id }).lean();
  const capacity = occ?.capacity ?? alloc.capacity;
  const occupied = occ?.occupied ?? 0;
  return {
    allocationId: String(alloc._id),
    floorId: String(alloc.floorId),
    floorName: floor?.name ?? "Unknown floor",
    floorCode: floor?.code ?? "?",
    vehicleType: alloc.vehicleType,
    capacity,
    occupied,
    available: capacity - occupied,
    status: computeStatus(capacity, occupied),
    preferred: alloc.preferred,
  };
}
