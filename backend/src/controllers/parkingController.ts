import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { Company } from "../models";
import { ParkingSession } from "../models";
import { VEHICLE_TYPES, SESSION_STATUSES } from "../types/enums";
import { ensureProjectAccess } from "../middleware/auth";
import { getCompanyAvailability } from "../services/availabilityService";
import { createEntry, completeExit } from "../services/parkingService";

export const availabilityQuerySchema = z.object({
  projectId: z.string().min(1),
  companyId: z.string().min(1),
  vehicleType: z.enum(VEHICLE_TYPES),
  floorId: z.string().optional(),
});

export const entrySchema = z.object({
  projectId: z.string().min(1),
  companyId: z.string().min(1),
  floorId: z.string().min(1),
  vehicleType: z.enum(VEHICLE_TYPES),
  vehicleNumber: z.string().trim().max(20).optional().nullable(),
  entryGateId: z.string().min(1),
});

export const exitSchema = z.object({
  sessionId: z.string().min(1),
  exitGateId: z.string().min(1),
});

export const getAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { projectId, companyId, vehicleType, floorId } = req.query as unknown as z.infer<
    typeof availabilityQuerySchema
  >;
  ensureProjectAccess(req.user!, projectId);

  const company = await Company.findOne({ _id: companyId, projectId }).lean();
  if (!company) throw AppError.notFound("Company not found for this project.");

  const allocations = await getCompanyAvailability(projectId, companyId, vehicleType, floorId);
  if (allocations.length === 0) {
    throw AppError.notFound(
      `No parking allocation exists for this company for ${vehicleType}.`,
      "ALLOCATION_NOT_FOUND"
    );
  }

  res.json({ company: { id: company._id, name: company.name, logoUrl: company.logoUrl }, vehicleType, allocations });
});

export const createEntryHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof entrySchema>;
  ensureProjectAccess(req.user!, data.projectId);

  if (req.user!.role !== "SUPER_ADMIN" && req.user!.role !== "ENTRY_GATEMAN") {
    throw AppError.forbidden("Only entry gate staff can record vehicle entries.");
  }
  if (req.user!.role === "ENTRY_GATEMAN" && req.user!.gateId && req.user!.gateId !== data.entryGateId) {
    throw AppError.forbidden("You are not assigned to this gate.");
  }

  const { session, availability } = await createEntry({
    projectId: data.projectId,
    companyId: data.companyId,
    floorId: data.floorId,
    vehicleType: data.vehicleType,
    vehicleNumber: data.vehicleNumber,
    entryGateId: data.entryGateId,
    entryUserId: req.user!.id,
  });

  res.status(201).json({
    session: {
      id: session._id,
      sessionCode: session.sessionCode,
      vehicleType: session.vehicleType,
      vehicleNumber: session.vehicleNumber,
      entryTime: session.entryTime,
      status: session.status,
    },
    availability,
  });
});

export const createExitHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof exitSchema>;

  if (req.user!.role !== "SUPER_ADMIN" && req.user!.role !== "EXIT_GATEMAN") {
    throw AppError.forbidden("Only exit gate staff can record vehicle exits.");
  }
  if (req.user!.role === "EXIT_GATEMAN" && req.user!.gateId && req.user!.gateId !== data.exitGateId) {
    throw AppError.forbidden("You are not assigned to this gate.");
  }

  const targetSession = await ParkingSession.findById(data.sessionId).lean();
  if (targetSession) ensureProjectAccess(req.user!, String(targetSession.projectId));

  const { session, availability } = await completeExit({
    sessionId: data.sessionId,
    exitGateId: data.exitGateId,
    exitUserId: req.user!.id,
  });

  res.json({
    session: {
      id: session._id,
      sessionCode: session.sessionCode,
      exitTime: session.exitTime,
      status: session.status,
    },
    availability,
  });
});

export const listActiveSessionsSchema = z.object({
  projectId: z.string().min(1),
  companyId: z.string().optional(),
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
  floorId: z.string().optional(),
  vehicleNumber: z.string().optional(),
  search: z.string().optional(),
});

export const listActiveSessions = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as z.infer<typeof listActiveSessionsSchema>;
  ensureProjectAccess(req.user!, query.projectId);

  const filter: Record<string, unknown> = { projectId: query.projectId, status: "ACTIVE" };
  if (query.companyId) filter.companyId = query.companyId;
  if (query.vehicleType) filter.vehicleType = query.vehicleType;
  if (query.floorId) filter.floorId = query.floorId;
  if (query.vehicleNumber) {
    filter.vehicleNumber = { $regex: query.vehicleNumber.trim().toUpperCase(), $options: "i" };
  }
  if (query.search) {
    filter.$or = [
      { vehicleNumber: { $regex: query.search, $options: "i" } },
      { sessionCode: { $regex: query.search, $options: "i" } },
    ];
  }

  const sessions = await ParkingSession.find(filter)
    .sort({ entryTime: -1 })
    .limit(200)
    .populate("companyId", "name logoUrl")
    .populate("floorId", "name code")
    .populate("entryGateId", "name")
    .lean();

  res.json({ sessions });
});

export const historyQuerySchema = z.object({
  projectId: z.string().min(1),
  companyId: z.string().optional(),
  floorId: z.string().optional(),
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
  vehicleNumber: z.string().optional(),
  status: z.enum(SESSION_STATUSES).optional(),
  entryGateId: z.string().optional(),
  exitGateId: z.string().optional(),
  entryDateFrom: z.string().optional(),
  entryDateTo: z.string().optional(),
  exitDateFrom: z.string().optional(),
  exitDateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const listHistory = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as z.infer<typeof historyQuerySchema>;
  ensureProjectAccess(req.user!, query.projectId);

  const filter: Record<string, unknown> = { projectId: query.projectId };
  if (query.companyId) filter.companyId = query.companyId;
  if (query.floorId) filter.floorId = query.floorId;
  if (query.vehicleType) filter.vehicleType = query.vehicleType;
  if (query.status) filter.status = query.status;
  if (query.entryGateId) filter.entryGateId = query.entryGateId;
  if (query.exitGateId) filter.exitGateId = query.exitGateId;
  if (query.vehicleNumber) {
    filter.vehicleNumber = { $regex: query.vehicleNumber.trim().toUpperCase(), $options: "i" };
  }
  if (query.entryDateFrom || query.entryDateTo) {
    filter.entryTime = {
      ...(query.entryDateFrom ? { $gte: new Date(query.entryDateFrom) } : {}),
      ...(query.entryDateTo ? { $lte: new Date(query.entryDateTo) } : {}),
    };
  }
  if (query.exitDateFrom || query.exitDateTo) {
    filter.exitTime = {
      ...(query.exitDateFrom ? { $gte: new Date(query.exitDateFrom) } : {}),
      ...(query.exitDateTo ? { $lte: new Date(query.exitDateTo) } : {}),
    };
  }

  const skip = (query.page - 1) * query.pageSize;
  const [sessions, total] = await Promise.all([
    ParkingSession.find(filter)
      .sort({ entryTime: -1 })
      .skip(skip)
      .limit(query.pageSize)
      .populate("companyId", "name")
      .populate("floorId", "name code")
      .populate("entryGateId", "name")
      .populate("exitGateId", "name")
      .lean(),
    ParkingSession.countDocuments(filter),
  ]);

  res.json({ sessions, total, page: query.page, pageSize: query.pageSize });
});
