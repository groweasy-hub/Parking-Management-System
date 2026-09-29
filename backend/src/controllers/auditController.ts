import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { AuditLog } from "../models";
import { ensureProjectAccess } from "../middleware/auth";

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const requester = req.user!;
  const filter: Record<string, unknown> = {};

  if (requester.role === "SUPER_ADMIN") {
    if (req.query.projectId) filter.projectId = req.query.projectId;
  } else {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) throw AppError.badRequest("projectId query param is required");
    ensureProjectAccess(requester, projectId);
    filter.projectId = projectId;
  }

  if (req.query.action) filter.action = req.query.action;
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.userId) filter.userId = req.query.userId;

  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 50)));

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("userId", "name email role")
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  res.json({ logs, total, page, pageSize });
});
