import { ClientSession, Types } from "mongoose";
import { AppError } from "../utils/AppError";
import { runInTransaction } from "../utils/transaction";
import { nextSequence } from "../models/Counter";
import {
  Company,
  Floor,
  Gate,
  Occupancy,
  ParkingAllocation,
  ParkingSession,
} from "../models";
import { VehicleType } from "../types/enums";
import { recordAudit } from "./auditService";
import { allocationVehicleTypeFor, getAllocationAvailability, getCompanyAvailability } from "./availabilityService";
import { broadcastToProject } from "../realtime/socketServer";

export interface EntryInput {
  projectId: string;
  companyId: string;
  floorId: string;
  vehicleType: VehicleType;
  vehicleNumber?: string | null;
  entryGateId: string;
  entryUserId: string;
}

export interface ExitInput {
  sessionId: string;
  exitGateId: string;
  exitUserId: string;
}

function normalizeVehicleNumber(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim().toUpperCase().replace(/\s+/g, "");
  return trimmed.length > 0 ? trimmed : null;
}

async function assertEntityInProject(
  projectId: string,
  ids: { gateId: string; companyId: string; floorId: string }
) {
  const [gate, company, floor] = await Promise.all([
    Gate.findOne({ _id: ids.gateId, projectId }).lean(),
    Company.findOne({ _id: ids.companyId, projectId }).lean(),
    Floor.findOne({ _id: ids.floorId, projectId }).lean(),
  ]);

  if (!gate) throw AppError.badRequest("Entry gate not found for this project.", "GATE_NOT_FOUND");
  if (gate.type !== "ENTRY") throw AppError.badRequest("This gate is not configured for entry.", "GATE_WRONG_TYPE");
  if (gate.status !== "ACTIVE") throw AppError.badRequest("This gate is inactive.", "GATE_INACTIVE");
  if (!company) throw AppError.badRequest("Company not found for this project.", "COMPANY_NOT_FOUND");
  if (company.status !== "ACTIVE") throw AppError.badRequest("This company is inactive.", "COMPANY_INACTIVE");
  if (!floor) throw AppError.badRequest("Floor not found for this project.", "FLOOR_NOT_FOUND");
  if (floor.status !== "ACTIVE") throw AppError.badRequest("This floor is inactive.", "FLOOR_INACTIVE");

  return { gate, company, floor };
}

/**
 * Creates a parking entry session atomically. Capacity is enforced by a
 * conditional update (`occupied < capacity`) on the Occupancy document
 * inside a MongoDB transaction, so under concurrent requests for the last
 * remaining slot only one can ever succeed — the loser gets a clean
 * "Parking is no longer available" error instead of overbooking capacity.
 */
export async function createEntry(input: EntryInput) {
  const vehicleNumber = normalizeVehicleNumber(input.vehicleNumber);
  const allocationVehicleType = allocationVehicleTypeFor(input.vehicleType);

  const { company, floor } = await assertEntityInProject(input.projectId, {
    gateId: input.entryGateId,
    companyId: input.companyId,
    floorId: input.floorId,
  });

  const allocation = await ParkingAllocation.findOne({
    projectId: input.projectId,
    companyId: input.companyId,
    floorId: input.floorId,
    vehicleType: allocationVehicleType,
    status: "ACTIVE",
  }).lean();

  if (!allocation) {
    throw AppError.badRequest(
      `No ${allocationVehicleType} parking allocation exists for this company on this floor.`,
      "ALLOCATION_NOT_FOUND"
    );
  }

  if (vehicleNumber) {
    const existingActive = await ParkingSession.findOne({
      projectId: input.projectId,
      vehicleNumber,
      status: "ACTIVE",
    }).lean();
    if (existingActive) {
      throw AppError.conflict("This vehicle is already inside the parking facility.", "VEHICLE_ALREADY_INSIDE");
    }
  }

  try {
    const session = await runInTransaction(async (dbSession: ClientSession) => {
      const updatedOccupancy = await Occupancy.findOneAndUpdate(
        { allocationId: allocation._id, $expr: { $lt: ["$occupied", "$capacity"] } },
        { $inc: { occupied: 1 } },
        { session: dbSession, new: true }
      );

      if (!updatedOccupancy) {
        throw AppError.conflict("Parking is no longer available.", "PARKING_FULL");
      }

      const seq = await nextSequence("parkingSession", dbSession);
      const sessionCode = `PS${String(seq).padStart(6, "0")}`;

      const [created] = await ParkingSession.create(
        [
          {
            sessionCode,
            projectId: input.projectId,
            companyId: input.companyId,
            floorId: input.floorId,
            allocationId: allocation._id,
            vehicleType: input.vehicleType,
            vehicleNumber,
            entryGateId: input.entryGateId,
            entryUserId: input.entryUserId,
            entryTime: new Date(),
            status: "ACTIVE",
          },
        ],
        { session: dbSession }
      );

      await recordAudit(
        {
          userId: input.entryUserId,
          projectId: input.projectId,
          action: "VEHICLE_ENTERED",
          entityType: "ParkingSession",
          entityId: created._id as Types.ObjectId,
          metadata: {
            sessionCode,
            companyId: input.companyId,
            floorId: input.floorId,
            vehicleType: input.vehicleType,
            vehicleNumber,
            entryGateId: input.entryGateId,
          },
        },
        dbSession
      );

      return created;
    });

    const availability = await getAllocationAvailability(String(allocation._id));
    broadcastToProject(input.projectId, "availability:update", availability);
    broadcastToProject(input.projectId, "session:entry", {
      sessionId: String(session._id),
      sessionCode: session.sessionCode,
      companyName: company.name,
      floorName: floor.name,
      vehicleType: session.vehicleType,
      vehicleNumber: session.vehicleNumber,
      entryTime: session.entryTime,
    });

    return { session, availability };
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      throw AppError.conflict("This vehicle is already inside the parking facility.", "VEHICLE_ALREADY_INSIDE");
    }
    throw err;
  }
}

/**
 * Completes a parking session atomically. The status transition itself is
 * the concurrency guard: `findOneAndUpdate` only matches documents that are
 * still ACTIVE, so if two exit requests race for the same session, exactly
 * one update matches and the other gets a "already completed" error.
 */
export async function completeExit(input: ExitInput) {
  const existing = await ParkingSession.findById(input.sessionId).lean();
  if (!existing) {
    throw AppError.notFound("Parking session not found.", "SESSION_NOT_FOUND");
  }

  const gate = await Gate.findOne({ _id: input.exitGateId, projectId: existing.projectId }).lean();
  if (!gate) throw AppError.badRequest("Exit gate not found for this project.", "GATE_NOT_FOUND");
  if (gate.type !== "EXIT") throw AppError.badRequest("This gate is not configured for exit.", "GATE_WRONG_TYPE");

  const result = await runInTransaction(async (dbSession: ClientSession) => {
    const exitTime = new Date();
    const updatedSession = await ParkingSession.findOneAndUpdate(
      { _id: input.sessionId, status: "ACTIVE" },
      {
        $set: {
          status: "COMPLETED",
          exitTime,
          exitGateId: input.exitGateId,
          exitUserId: input.exitUserId,
        },
      },
      { session: dbSession, new: true }
    );

    if (!updatedSession) {
      throw AppError.conflict("This parking session has already been completed.", "SESSION_ALREADY_COMPLETED");
    }

    await Occupancy.findOneAndUpdate(
      { allocationId: updatedSession.allocationId, occupied: { $gt: 0 } },
      { $inc: { occupied: -1 } },
      { session: dbSession }
    );

    await recordAudit(
      {
        userId: input.exitUserId,
        projectId: String(updatedSession.projectId),
        action: "VEHICLE_EXITED",
        entityType: "ParkingSession",
        entityId: updatedSession._id as Types.ObjectId,
        metadata: {
          sessionCode: updatedSession.sessionCode,
          exitGateId: input.exitGateId,
          durationMs: exitTime.getTime() - updatedSession.entryTime.getTime(),
        },
      },
      dbSession
    );

    return updatedSession;
  });

  const availability = await getAllocationAvailability(String(result.allocationId));
  broadcastToProject(String(result.projectId), "availability:update", availability);
  broadcastToProject(String(result.projectId), "session:exit", {
    sessionId: String(result._id),
    sessionCode: result.sessionCode,
    exitTime: result.exitTime,
  });

  return { session: result, availability };
}

export { getCompanyAvailability };
