import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import path from "path";
import { env } from "./config/env";
import { apiLimiter } from "./middleware/rateLimiters";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

import { authenticate } from "./middleware/auth";
import { validate } from "./middleware/validate";
import { availabilityQuerySchema, getAvailability } from "./controllers/parkingController";

import authRoutes from "./routes/authRoutes";
import projectRoutes from "./routes/projectRoutes";
import floorRoutes from "./routes/floorRoutes";
import companyRoutes from "./routes/companyRoutes";
import allocationRoutes from "./routes/allocationRoutes";
import gateRoutes from "./routes/gateRoutes";
import userRoutes from "./routes/userRoutes";
import parkingRoutes from "./routes/parkingRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import reportRoutes from "./routes/reportRoutes";
import auditRoutes from "./routes/auditRoutes";
import settingsRoutes from "./routes/settingsRoutes";

export function createApp() {
  const app = express();
  // Needed for correct req.ip (and therefore accurate rate limiting) when
  // deployed behind a reverse proxy/load balancer (Render, Railway, etc.).
  app.set("trust proxy", 1);

  // crossOriginResourcePolicy defaults to same-origin, which would block the
  // frontend (a different origin) from rendering uploaded company logos.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  app.use("/api", apiLimiter);

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/floors", floorRoutes);
  app.use("/api/companies", companyRoutes);
  app.use("/api/parking-allocations", allocationRoutes);
  app.use("/api/gates", gateRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/parking", parkingRoutes);
  // Also exposed at the top level to match the spec's documented endpoint name.
  app.get("/api/parking-availability", authenticate, validate(availabilityQuerySchema, "query"), getAvailability);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/audit-logs", auditRoutes);
  app.use("/api/settings", settingsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
