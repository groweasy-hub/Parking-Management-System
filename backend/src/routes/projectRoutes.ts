import { Router } from "express";
import {
  createProject,
  createProjectSchema,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
  updateProjectSchema,
} from "../controllers/projectController";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);
router.get("/", listProjects);
router.get("/:id", getProject);
router.post("/", requireRole("SUPER_ADMIN"), validate(createProjectSchema), createProject);
router.patch("/:id", requireRole("SUPER_ADMIN"), validate(updateProjectSchema), updateProject);
router.delete("/:id", requireRole("SUPER_ADMIN"), deleteProject);

export default router;
