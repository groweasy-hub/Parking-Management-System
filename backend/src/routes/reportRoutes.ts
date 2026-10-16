import { Router } from "express";
import {
  activeVehiclesCount,
  averageDurationReport,
  dailyEntriesExits,
  exportHistoryCsv,
  peakOccupancyReport,
  rangeSchema,
  utilizationReport,
} from "../controllers/reportController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { historyQuerySchema } from "../controllers/parkingController";

const router = Router();

router.use(authenticate);
router.get("/entries-exits", validate(rangeSchema, "query"), dailyEntriesExits);
router.get("/utilization", validate(rangeSchema, "query"), utilizationReport);
router.get("/peak-occupancy", validate(rangeSchema, "query"), peakOccupancyReport);
router.get("/average-duration", validate(rangeSchema, "query"), averageDurationReport);
router.get("/active-vehicles", validate(rangeSchema, "query"), activeVehiclesCount);
router.get("/history/export", validate(historyQuerySchema, "query"), exportHistoryCsv);

export default router;
