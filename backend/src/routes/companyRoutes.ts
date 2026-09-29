import { Router } from "express";
import multer from "multer";
import {
  createCompany,
  createCompanySchema,
  listCompanies,
  updateCompany,
  updateCompanySchema,
  uploadLogo,
} from "../controllers/companyController";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

const router = Router();

router.use(authenticate);
router.get("/", listCompanies);
router.post("/", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), validate(createCompanySchema), createCompany);
router.patch("/:id", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), validate(updateCompanySchema), updateCompany);
router.post(
  "/:id/logo",
  requireRole("SUPER_ADMIN", "PROJECT_ADMIN"),
  upload.single("logo"),
  uploadLogo
);

export default router;
