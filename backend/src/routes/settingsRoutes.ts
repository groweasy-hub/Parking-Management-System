import { Router } from "express";
import { reconcileOccupancyHandler, reconcileSchema } from "../controllers/settingsController";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);
router.post(
  "/reconcile-occupancy",
  requireRole("SUPER_ADMIN", "PROJECT_ADMIN"),
  validate(reconcileSchema),
  reconcileOccupancyHandler
);

export default router;
