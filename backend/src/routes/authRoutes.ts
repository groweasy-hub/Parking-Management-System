import { Router } from "express";
import { login, logout, refresh, me } from "../controllers/authController";
import { loginSchema } from "../controllers/authController";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { loginLimiter } from "../middleware/rateLimiters";

const router = Router();

router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/logout", authenticate, logout);
router.post("/refresh", refresh);
router.get("/me", authenticate, me);

export default router;
