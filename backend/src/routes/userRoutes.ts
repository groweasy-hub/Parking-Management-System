import { Router } from "express";
import { createUser, createUserSchema, listUsers, updateUser, updateUserSchema } from "../controllers/userController";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);
router.get("/", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), listUsers);
router.post("/", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), validate(createUserSchema), createUser);
router.patch("/:id", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), validate(updateUserSchema), updateUser);

export default router;
