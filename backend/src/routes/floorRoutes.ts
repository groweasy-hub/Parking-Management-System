import { Router } from "express";
import {
  createFloor,
  createFloorSchema,
  deleteFloor,
  listFloors,
  reorderFloors,
  reorderFloorsSchema,
  updateFloor,
  updateFloorSchema,
} from "../controllers/floorController";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);
router.get("/", listFloors);
router.post("/", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), validate(createFloorSchema), createFloor);
router.patch("/reorder", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), validate(reorderFloorsSchema), reorderFloors);
router.patch("/:id", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), validate(updateFloorSchema), updateFloor);
router.delete("/:id", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), deleteFloor);

export default router;
