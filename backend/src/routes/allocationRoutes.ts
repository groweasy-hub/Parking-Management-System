import { Router } from "express";
import {
  createAllocation,
  createAllocationSchema,
  listAllocations,
  updateAllocation,
  updateAllocationSchema,
} from "../controllers/allocationController";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);
router.get("/", listAllocations);
router.post(
  "/",
  requireRole("SUPER_ADMIN", "PROJECT_ADMIN"),
  validate(createAllocationSchema),
  createAllocation
);
router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "PROJECT_ADMIN"),
  validate(updateAllocationSchema),
  updateAllocation
);

export default router;
