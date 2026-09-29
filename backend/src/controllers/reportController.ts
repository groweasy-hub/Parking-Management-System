import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { ParkingSession, ParkingAllocation, Occupancy } from "../models";
import { VEHICLE_TYPES } from "../types/enums";
import { ensureProjectAccess } from "../middleware/auth";

const rangeSchema = z.object({
  projectId: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  companyId: z.string().optional(),
  floorId: z.string().optional(),
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
});
export { rangeSchema };

function parseRange(query: z.infer<typeof rangeSchema>) {
  const from = query.from ? new Date(query.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const to = query.to ? new Date(query.to) : new Date();
  return { from, to };
}

export const dailyEntriesExits = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as z.infer<typeof rangeSchema>;
  ensureProjectAccess(req.user!, query.projectId);
  const { from, to } = parseRange(query);

  const baseFilter = { projectId: query.projectId } as Record<string, unknown>;
  if (query.companyId) baseFilter.companyId = query.companyId;
  if (query.floorId) baseFilter.floorId = query.floorId;
  if (query.vehicleType) baseFilter.vehicleType = query.vehicleType;

  const [entries, exits] = await Promise.all([
    ParkingSession.aggregate([
      { $match: { ...baseFilter, entryTime: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$entryTime" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    ParkingSession.aggregate([
      { $match: { ...baseFilter, exitTime: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$exitTime" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const days = new Map<string, { date: string; entries: number; exits: number }>();
  for (const e of entries) days.set(e._id, { date: e._id, entries: e.count, exits: 0 });
  for (const e of exits) {
    const existing = days.get(e._id);
    if (existing) existing.exits = e.count;
    else days.set(e._id, { date: e._id, entries: 0, exits: e.count });
  }

  res.json({ range: { from, to }, days: Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date)) });
});

export const utilizationReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as z.infer<typeof rangeSchema>;
  ensureProjectAccess(req.user!, query.projectId);

  const filter: Record<string, unknown> = { projectId: query.projectId, status: "ACTIVE" };
  if (query.companyId) filter.companyId = query.companyId;
  if (query.floorId) filter.floorId = query.floorId;
  if (query.vehicleType) filter.vehicleType = query.vehicleType;

  const allocations = await ParkingAllocation.find(filter)
    .populate("companyId", "name")
    .populate("floorId", "name code")
    .lean();
  const occupancies = await Occupancy.find({
    allocationId: { $in: allocations.map((a) => a._id) },
  }).lean();
  const occMap = new Map(occupancies.map((o) => [String(o.allocationId), o]));

  const rows = allocations.map((a) => {
    const occ = occMap.get(String(a._id));
    const capacity = occ?.capacity ?? a.capacity;
    const occupied = occ?.occupied ?? 0;
    return {
      allocationId: String(a._id),
      company: (a.companyId as unknown as { name: string })?.name ?? "Unknown",
      floor: (a.floorId as unknown as { name: string; code: string })?.name ?? "Unknown",
      vehicleType: a.vehicleType,
      capacity,
      occupied,
      utilizationPct: capacity > 0 ? Math.round((occupied / capacity) * 1000) / 10 : 0,
    };
  });

  res.json({ rows });
});

export const peakOccupancyReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as z.infer<typeof rangeSchema>;
  ensureProjectAccess(req.user!, query.projectId);
  const { from, to } = parseRange(query);

  const filter: Record<string, unknown> = {
    projectId: query.projectId,
    entryTime: { $lte: to },
    $or: [{ exitTime: null }, { exitTime: { $gte: from } }],
  };
  if (query.companyId) filter.companyId = query.companyId;
  if (query.floorId) filter.floorId = query.floorId;
  if (query.vehicleType) filter.vehicleType = query.vehicleType;

  const sessions = await ParkingSession.find(filter, { entryTime: 1, exitTime: 1 }).lean();

  type Event = { time: number; delta: number };
  const events: Event[] = [];
  for (const s of sessions) {
    const start = Math.max(s.entryTime.getTime(), from.getTime());
    const end = s.exitTime ? Math.min(s.exitTime.getTime(), to.getTime()) : to.getTime();
    if (end < start) continue;
    events.push({ time: start, delta: 1 });
    events.push({ time: end, delta: -1 });
  }
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);

  let current = 0;
  let peak = 0;
  let peakTime: number | null = null;
  for (const ev of events) {
    current += ev.delta;
    if (current > peak) {
      peak = current;
      peakTime = ev.time;
    }
  }

  res.json({ range: { from, to }, peakOccupancy: peak, peakTime: peakTime ? new Date(peakTime) : null });
});

export const averageDurationReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as z.infer<typeof rangeSchema>;
  ensureProjectAccess(req.user!, query.projectId);
  const { from, to } = parseRange(query);

  const filter: Record<string, unknown> = {
    projectId: query.projectId,
    status: "COMPLETED",
    exitTime: { $gte: from, $lte: to },
  };
  if (query.companyId) filter.companyId = query.companyId;
  if (query.floorId) filter.floorId = query.floorId;
  if (query.vehicleType) filter.vehicleType = query.vehicleType;

  const [result] = await ParkingSession.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        avgDurationMs: { $avg: { $subtract: ["$exitTime", "$entryTime"] } },
        count: { $sum: 1 },
      },
    },
  ]);

  res.json({
    range: { from, to },
    averageDurationMinutes: result ? Math.round(result.avgDurationMs / 60000) : 0,
    sampledSessions: result?.count ?? 0,
  });
});

export const activeVehiclesCount = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as z.infer<typeof rangeSchema>;
  ensureProjectAccess(req.user!, query.projectId);

  const filter: Record<string, unknown> = { projectId: query.projectId, status: "ACTIVE" };
  if (query.companyId) filter.companyId = query.companyId;
  if (query.floorId) filter.floorId = query.floorId;
  if (query.vehicleType) filter.vehicleType = query.vehicleType;

  const count = await ParkingSession.countDocuments(filter);
  res.json({ activeVehicles: count });
});

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export const exportHistoryCsv = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  if (!projectId) throw AppError.badRequest("projectId query param is required");
  ensureProjectAccess(req.user!, projectId);

  const filter: Record<string, unknown> = { projectId };
  if (req.query.companyId) filter.companyId = req.query.companyId;
  if (req.query.floorId) filter.floorId = req.query.floorId;
  if (req.query.vehicleType) filter.vehicleType = req.query.vehicleType;
  if (req.query.status) filter.status = req.query.status;

  const sessions = await ParkingSession.find(filter)
    .sort({ entryTime: -1 })
    .limit(10000)
    .populate("companyId", "name")
    .populate("floorId", "name code")
    .populate("entryGateId", "name")
    .populate("exitGateId", "name")
    .lean();

  const header = [
    "Session ID",
    "Vehicle Number",
    "Vehicle Type",
    "Company",
    "Floor",
    "Entry Time",
    "Exit Time",
    "Entry Gate",
    "Exit Gate",
    "Status",
  ];

  const rows = sessions.map((s) =>
    [
      s.sessionCode,
      s.vehicleNumber ?? "Not Provided",
      s.vehicleType,
      (s.companyId as unknown as { name: string })?.name ?? "",
      (s.floorId as unknown as { name: string })?.name ?? "",
      s.entryTime?.toISOString() ?? "",
      s.exitTime ? s.exitTime.toISOString() : "",
      (s.entryGateId as unknown as { name: string })?.name ?? "",
      (s.exitGateId as unknown as { name: string })?.name ?? "",
      s.status,
    ]
      .map(escapeCsv)
      .join(",")
  );

  const csv = [header.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="parking-history-${Date.now()}.csv"`);
  res.send(csv);
});
