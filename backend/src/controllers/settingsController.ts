import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { ensureProjectAccess } from "../middleware/auth";
import { reconcileOccupancy } from "../services/reconciliationService";

export const reconcileSchema = z.object({
  projectId: z.string().min(1),
});

export const reconcileOccupancyHandler = asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.body as z.infer<typeof reconcileSchema>;
  ensureProjectAccess(req.user!, projectId);

  const results = await reconcileOccupancy(projectId, req.user!.id);
  const corrections = results.filter((r) => r.corrected);

  res.json({ checked: results.length, corrected: corrections.length, results });
});
