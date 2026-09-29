import { Router } from "express";
import { getCompanyDashboard, getFloorDashboard, getSummary } from "../controllers/dashboardController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.get("/summary", getSummary);
router.get("/floors", getFloorDashboard);
router.get("/company", getCompanyDashboard);

export default router;
