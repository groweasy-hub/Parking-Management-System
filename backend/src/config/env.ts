import "dotenv/config";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "https://frontend-wy5s.vercel.app",
];

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeOrigin(origin: string): string | null {
  const trimmed = origin.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

function parseCorsOrigins(value: string): string[] {
  return Array.from(
    new Set(
      [value, process.env.FRONTEND_URL ?? "", ...DEFAULT_CORS_ORIGINS]
        .join(",")
        .split(",")
        .map(normalizeOrigin)
        .filter((origin): origin is string => Boolean(origin))
    )
  );
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: required("MONGODB_URI"),
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "45d",
  },
  cookieDomain: process.env.COOKIE_DOMAIN ?? "localhost",
  corsOrigin: parseCorsOrigins(process.env.CORS_ORIGIN ?? "http://localhost:3000"),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },
  notifications: {
    passwordResetWebhookUrl: process.env.PASSWORD_RESET_WEBHOOK_URL ?? "",
  },
  seed: {
    superAdminEmail: process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@parking.local",
    superAdminPassword: process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!",
  },
} as const;

export const isProduction = env.nodeEnv === "production";
