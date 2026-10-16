import { ParkingAllocation, ParkingSession, Occupancy, Company, Floor } from "../models";
import { recordAudit } from "./auditService";
import { runInTransaction } from "../utils/transaction";

export interface ReconciliationResult {
  allocationId: string;
  companyName: string;
  floorName: string;
  vehicleType: string;
  previousOccupied: number;
  actualOccupied: number;
  corrected: boolean;
}

/**
 * Recomputes occupancy.occupied from the COUNT of ACTIVE sessions per
 * allocation — the authoritative source of truth — and corrects any drift.
 * Safe to run at any time; every correction is audited.
 */
export async function reconcileOccupancy(
  projectId: string,
  actorUserId: string | null
): Promise<ReconciliationResult[]> {
  const allocations = await ParkingAllocation.find({ projectId }).lean();
  const [companies, floors] = await Promise.all([
    Company.find({ _id: { $in: allocations.map((a) => a.companyId) } }).lean(),
    Floor.find({ _id: { $in: allocations.map((a) => a.floorId) } }).lean(),
  ]);
  const companyMap = new Map(companies.map((c) => [String(c._id), c.name]));
  const floorMap = new Map(floors.map((f) => [String(f._id), f.name]));
  const results: ReconciliationResult[] = [];

  for (const allocation of allocations) {
    const result = await runInTransaction(async (session) => {
      const current = await ParkingAllocation.findById(allocation._id).session(session).lean();
      if (!current) return null;
      // Lock the same counter used by entry/exit before counting sessions. A
      // concurrent parking operation forces a retry instead of being overwritten.
      const occ = await Occupancy.findOneAndUpdate(
        { allocationId: allocation._id },
        { $set: { projectId: current.projectId, capacity: current.capacity }, $setOnInsert: { occupied: 0 } },
        { upsert: true, session, new: false }
      ).lean();
      const actualOccupied = await ParkingSession.countDocuments({ allocationId: allocation._id, status: "ACTIVE" }).session(session);
      const previousOccupied = occ?.occupied ?? 0;
      const corrected = previousOccupied !== actualOccupied || !occ || occ.capacity !== current.capacity;
      if (corrected) {
        await Occupancy.updateOne(
          { allocationId: allocation._id },
          {
            $set: {
              projectId: current.projectId,
              capacity: current.capacity,
              occupied: actualOccupied,
            },
          },
          { session }
        );
        await recordAudit(
          {
            userId: actorUserId,
            projectId,
            action: "OCCUPANCY_RECONCILED",
            entityType: "ParkingAllocation",
            entityId: allocation._id,
            metadata: { previousOccupied, actualOccupied, capacity: current.capacity },
          },
          session
        );
      }
      return { previousOccupied, actualOccupied, corrected };
    });
    if (!result) continue;
    results.push({
      allocationId: String(allocation._id),
      companyName: companyMap.get(String(allocation.companyId)) ?? "Unknown company",
      floorName: floorMap.get(String(allocation.floorId)) ?? "Unknown floor",
      vehicleType: allocation.vehicleType,
      ...result,
    });
  }

  return results;
}
