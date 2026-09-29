import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { Company } from "../models";
import { ensureProjectAccess } from "../middleware/auth";
import { recordAudit } from "../services/auditService";
import { deleteCompanyLogo, uploadCompanyLogo } from "../services/storageService";
import { generateUniqueCode } from "../utils/codeGenerator";

export const createCompanySchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  // The building floor the company's office is on — NOT a parking floor.
  officeFloor: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  serviceType: z.string().max(100).optional(),
  address: z.string().max(300).optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
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
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
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
    officeFloor: data.officeFloor,
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
