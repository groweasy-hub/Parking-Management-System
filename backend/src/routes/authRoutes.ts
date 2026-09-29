import { Router } from "express";
import { changePassword, login, logout, refresh, me, updateProfile } from "../controllers/authController";
import { changePasswordSchema, loginSchema, updateProfileSchema } from "../controllers/authController";
import { validate } from "../middleware/validate";
import { authenticate, requireRole } from "../middleware/auth";
import { loginLimiter } from "../middleware/rateLimiters";

const router = Router();

router.post(
  "/login",
  loginLimiter,
  validate(loginSchema, "body", {
    genericMessage: "Incorrect email or password",
    genericCode: "INVALID_CREDENTIALS",
    logLabel: "auth.login",
  }),
  login
);
router.post("/logout", authenticate, logout);
router.post("/refresh", refresh);
router.get("/me", authenticate, me);
router.patch(
  "/profile",
  authenticate,
  requireRole("SUPER_ADMIN"),
  validate(updateProfileSchema, "body", {
    genericMessage: "Unable to update profile.",
    genericCode: "PROFILE_UPDATE_FAILED",
    logLabel: "auth.updateProfile",
  }),
  updateProfile
);
router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema, "body", {
    genericMessage: "Unable to change password.",
    genericCode: "PASSWORD_CHANGE_FAILED",
    logLabel: "auth.changePassword",
  }),
  changePassword
);

export default router;
