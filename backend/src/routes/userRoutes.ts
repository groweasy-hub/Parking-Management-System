import { Router } from "express";
import { createUser, createUserSchema, listUsers, updateUser, updateUserSchema } from "../controllers/userController";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);
router.get("/", requireRole("SUPER_ADMIN", "PROJECT_ADMIN"), listUsers);
router.post(
  "/",
  requireRole("SUPER_ADMIN", "PROJECT_ADMIN"),
  validate(createUserSchema, "body", {
    genericMessage: "Unable to complete registration.",
    genericCode: "REGISTRATION_FAILED",
    logLabel: "users.create",
  }),
  createUser
);
router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "PROJECT_ADMIN"),
  validate(updateUserSchema, "body", {
    genericMessage: "Unable to update user.",
    genericCode: "USER_UPDATE_FAILED",
    logLabel: "users.update",
  }),
  updateUser
);

export default router;
