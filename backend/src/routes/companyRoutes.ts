import { Router } from "express";
import multer from "multer";
import {
  createCompany,
  createCompanySchema,
  deleteCompany,
  listCompanies,
  updateCompany,
  updateCompanySchema,
  uploadLogo,
} from "../controllers/companyController";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../utils/AppError";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.mimetype)) {
      return cb(AppError.badRequest("Please upload a PNG, JPEG, WebP, or GIF image.", "INVALID_UPLOAD"));
    }
    cb(null, true);
  },
});

const router = Router();

router.use(authenticate);
router.get("/", listCompanies);
router.post("/", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), validate(createCompanySchema), createCompany);
router.patch("/:id", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), validate(updateCompanySchema), updateCompany);
router.delete("/:id", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), deleteCompany);
router.post(
  "/:id/logo",
  requireRole("SUPER_ADMIN", "PROJECT_ADMIN"),
  upload.single("logo"),
  uploadLogo
);

export default router;
