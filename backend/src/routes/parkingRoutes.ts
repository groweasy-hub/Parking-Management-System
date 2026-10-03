import { Router } from "express";
import {
  availabilityQuerySchema,
  createEntryHandler,
  createExitHandler,
  entrySchema,
  exitSchema,
  getSessionByQr,
  getAvailability,
  historyQuerySchema,
  listActiveSessions,
  listActiveSessionsSchema,
  listHistory,
  qrLookupSchema,
} from "../controllers/parkingController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { gateOperationLimiter } from "../middleware/rateLimiters";

const router = Router();

router.use(authenticate);
router.get("/availability", validate(availabilityQuerySchema, "query"), getAvailability);
router.get("/active", validate(listActiveSessionsSchema, "query"), listActiveSessions);
router.get("/qr", validate(qrLookupSchema, "query"), getSessionByQr);
router.get("/history", validate(historyQuerySchema, "query"), listHistory);
router.post("/entry", gateOperationLimiter, validate(entrySchema), createEntryHandler);
router.post("/exit", gateOperationLimiter, validate(exitSchema), createExitHandler);

export default router;
