import { Router } from "express";
import {
  attendanceQuerySchema,
  endGateDuty,
  getTodayDuty,
  getUserAttendance,
  startGateDuty,
  startGateDutySchema,
} from "../controllers/gateDutyController";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);
router.get("/today", getTodayDuty);
router.post("/start", validate(startGateDutySchema), startGateDuty);
router.post("/end", endGateDuty);
router.get(
  "/users/:userId/attendance",
  requireRole("SUPER_ADMIN", "PROJECT_ADMIN"),
  validate(attendanceQuerySchema, "query"),
  getUserAttendance
);

export default router;
