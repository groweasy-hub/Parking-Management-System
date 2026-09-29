import { Router } from "express";
import { listAuditLogs } from "../controllers/auditController";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.get("/", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), listAuditLogs);

export default router;
