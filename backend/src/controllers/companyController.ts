import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { Company, Occupancy, ParkingAllocation, ParkingSession } from "../models";
import { ensureProjectAccess } from "../middleware/auth";
import { recordAudit } from "../services/auditService";
import { deleteCompanyLogo, uploadCompanyLogo } from "../services/storageService";
import { generateUniqueCode } from "../utils/codeGenerator";
import { escapeRegex } from "../utils/search";
import { runInTransaction } from "../utils/transaction";

export const createCompanySchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  // Building floors occupied by the company's office, not parking floors.
  officeFloors: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
  // Legacy single-floor field retained for existing API clients.
  officeFloor: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  serviceType: z.string().max(100).optional(),
  address: z.string().max(300).optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  officeFloors: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
  officeFloor: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  serviceType: z.string().max(100).optional(),
  address: z.string().max(300).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const listCompanies = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  if (!projectId) throw AppError.badRequest("projectId query param is required");
  ensureProjectAccess(req.user!, projectId);

  const search = (req.query.search as string | undefined)?.trim();
  const filter: Record<string, unknown> = { projectId };
  if (search) {
    filter.$or = [
      { name: { $regex: escapeRegex(search), $options: "i" } },
      { code: { $regex: escapeRegex(search), $options: "i" } },
    ];
  }

  const companies = await Company.find(filter).sort({ name: 1 }).lean();
  res.json({ companies });
});

export const createCompany = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof createCompanySchema>;
  ensureProjectAccess(req.user!, data.projectId);

  const code = await generateUniqueCode(data.name, async (candidate) => {
    const existing = await Company.findOne({ projectId: data.projectId, code: candidate }).lean();
    return Boolean(existing);
  });

  const company = await Company.create({
    projectId: data.projectId,
    name: data.name,
    code,
    officeFloors: data.officeFloors ?? (data.officeFloor ? [data.officeFloor] : []),
    officeFloor: data.officeFloors?.[0] ?? data.officeFloor,
    email: data.email || undefined,
    phone: data.phone,
    serviceType: data.serviceType,
    address: data.address,
    status: "ACTIVE",
  });

  await recordAudit({
    userId: req.user!.id,
    projectId: data.projectId,
    action: "COMPANY_CREATED",
    entityType: "Company",
    entityId: company._id as never,
    metadata: { name: company.name, code: company.code },
  });

  res.status(201).json({ company });
});

export const updateCompany = asyncHandler(async (req: Request, res: Response) => {
  const existing = await Company.findById(req.params.id);
  if (!existing) throw AppError.notFound("Company not found.");
  ensureProjectAccess(req.user!, String(existing.projectId));

  const data = req.body as z.infer<typeof updateCompanySchema>;
  Object.assign(existing, data);
  if (data.officeFloors !== undefined) {
    existing.officeFloor = data.officeFloors[0];
  } else if (data.officeFloor !== undefined) {
    existing.officeFloors = data.officeFloor ? [data.officeFloor] : [];
  }
  await existing.save();

  await recordAudit({
    userId: req.user!.id,
    projectId: String(existing.projectId),
    action: "COMPANY_UPDATED",
    entityType: "Company",
    entityId: existing._id as never,
    metadata: data,
  });

  res.json({ company: existing });
});

export const deleteCompany = asyncHandler(async (req: Request, res: Response) => {
  const existing = await Company.findById(req.params.id);
  if (!existing) throw AppError.notFound("Company not found.");
  ensureProjectAccess(req.user!, String(existing.projectId));

  await runInTransaction(async (session) => {
    const activeSessions = await ParkingSession.countDocuments({
      projectId: existing.projectId,
      companyId: existing._id,
      status: "ACTIVE",
    }).session(session);
    if (activeSessions > 0) {
      throw AppError.conflict(
        "This company has vehicles currently parked. Complete their exits before deleting the company.",
        "COMPANY_HAS_ACTIVE_SESSIONS"
      );
    }

    const allocations = await ParkingAllocation.find({
      projectId: existing.projectId,
      companyId: existing._id,
    }).select("_id").session(session).lean();
    const allocationIds = allocations.map((allocation) => allocation._id);

    await recordAudit({
      userId: req.user!.id,
      projectId: String(existing.projectId),
      action: "COMPANY_DELETED",
      entityType: "Company",
      entityId: existing._id as never,
      metadata: { name: existing.name, code: existing.code, deletedAllocationCount: allocationIds.length },
    }, session);

    await Occupancy.deleteMany({ allocationId: { $in: allocationIds } }, { session });
    await ParkingSession.deleteMany({ projectId: existing.projectId, companyId: existing._id }, { session });
    await ParkingAllocation.deleteMany({ projectId: existing.projectId, companyId: existing._id }, { session });
    await Company.deleteOne({ _id: existing._id }, { session });
  });

  if (existing.logoStorageId) await deleteCompanyLogo(existing.logoStorageId);
  res.json({ success: true });
});

export const uploadLogo = asyncHandler(async (req: Request, res: Response) => {
  const existing = await Company.findById(req.params.id);
  if (!existing) throw AppError.notFound("Company not found.");
  ensureProjectAccess(req.user!, String(existing.projectId));

  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw AppError.badRequest("No logo file uploaded.");

  const previousStorageId = existing.logoStorageId;
  const { url, storageId } = await uploadCompanyLogo(file.buffer, file.originalname);

  existing.logoUrl = url;
  existing.logoStorageId = storageId;
  await existing.save();

  if (previousStorageId) {
    await deleteCompanyLogo(previousStorageId);
  }

  await recordAudit({
    userId: req.user!.id,
    projectId: String(existing.projectId),
    action: "COMPANY_LOGO_UPDATED",
    entityType: "Company",
    entityId: existing._id as never,
  });

  res.json({ company: existing });
});
