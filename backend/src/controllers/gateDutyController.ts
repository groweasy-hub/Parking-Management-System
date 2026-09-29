import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { Gate, GateDuty } from "../models";
import { ensureProjectAccess } from "../middleware/auth";
import { recordAudit } from "../services/auditService";

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export const startGateDutySchema = z.object({
  projectId: z.string().min(1),
  gateId: z.string().min(1),
});

export const attendanceQuerySchema = z.object({
  projectId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export const getTodayDuty = asyncHandler(async (req: Request, res: Response) => {
  if (req.user!.role !== "GATEKEEPER") throw AppError.forbidden();

  const duty = await GateDuty.findOne({ userId: req.user!.id, dutyDate: todayKey() })
    .populate("gateId", "name type")
    .lean();

  res.json({ duty });
});

export const startGateDuty = asyncHandler(async (req: Request, res: Response) => {
  if (req.user!.role !== "GATEKEEPER") throw AppError.forbidden();
  const data = req.body as z.infer<typeof startGateDutySchema>;
  ensureProjectAccess(req.user!, data.projectId);

  const gate = await Gate.findOne({ _id: data.gateId, projectId: data.projectId, status: "ACTIVE" }).lean();
  if (!gate) throw AppError.badRequest("Active gate not found for this project.");

  const duty = await GateDuty.findOneAndUpdate(
    { userId: req.user!.id, dutyDate: todayKey() },
    {
      $setOnInsert: {
        userId: req.user!.id,
        projectId: data.projectId,
        gateId: gate._id,
        gateType: gate.type,
        dutyDate: todayKey(),
        startedAt: new Date(),
        entryCount: 0,
        exitCount: 0,
      },
    },
    { upsert: true, new: true }
  ).populate("gateId", "name type");

  await recordAudit({
    userId: req.user!.id,
    projectId: data.projectId,
    action: "GATE_DUTY_STARTED",
    entityType: "GateDuty",
    entityId: duty._id as never,
    metadata: { gateId: data.gateId, gateType: gate.type },
  });

  res.status(201).json({ duty });
});

export const endGateDuty = asyncHandler(async (req: Request, res: Response) => {
  if (req.user!.role !== "GATEKEEPER") throw AppError.forbidden();
  const duty = await GateDuty.findOneAndUpdate(
    { userId: req.user!.id, dutyDate: todayKey(), endedAt: null },
    { $set: { endedAt: new Date() } },
    { new: true }
  );
  if (!duty) throw AppError.notFound("No active duty found for today.");

  await recordAudit({
    userId: req.user!.id,
    projectId: String(duty.projectId),
    action: "GATE_DUTY_ENDED",
    entityType: "GateDuty",
    entityId: duty._id as never,
  });

  res.json({ duty });
});

export const getUserAttendance = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as z.infer<typeof attendanceQuerySchema>;
  ensureProjectAccess(req.user!, query.projectId);

  const [year, month] = query.month.split("-").map(Number);
  const days = new Date(year, month, 0).getDate();
  const start = `${query.month}-01`;
  const end = `${query.month}-${String(days).padStart(2, "0")}`;

  const duties = await GateDuty.find({
    userId: req.params.userId,
    projectId: query.projectId,
    dutyDate: { $gte: start, $lte: end },
  })
    .populate("gateId", "name type")
    .lean();

  const dutyMap = new Map(duties.map((d) => [d.dutyDate, d]));
  res.json({
    days: Array.from({ length: days }, (_, index) => {
      const date = `${query.month}-${String(index + 1).padStart(2, "0")}`;
      const duty = dutyMap.get(date);
      return {
        date,
        worked: Boolean(duty && (duty.entryCount > 0 || duty.exitCount > 0)),
        visited: Boolean(duty),
        duty: duty ?? null,
      };
    }),
  });
});
