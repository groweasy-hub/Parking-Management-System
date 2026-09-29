import { Router } from "express";
import { createGate, createGateSchema, deleteGate, listGates, updateGate, updateGateSchema } from "../controllers/gateController";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);
router.get("/", listGates);
router.post("/", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), validate(createGateSchema), createGate);
router.patch("/:id", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), validate(updateGateSchema), updateGate);
router.delete("/:id", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), deleteGate);

export default router;
