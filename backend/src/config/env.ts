import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
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
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(","),
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
