import crypto from "node:crypto";
import { env } from "../config/env";

const QR_PREFIX = "PARKFLOW";

export interface ParkingQrPayload {
  sessionId: string;
  sessionCode: string;
  projectId: string;
  vehicleNumber: string | null;
  entryTime: string;
  companyName: string;
  floorName: string;
  floorCode?: string;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", env.jwt.accessSecret).update(payload).digest("base64url");
}

export function createParkingQrToken(payload: ParkingQrPayload): string {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${QR_PREFIX}.${encoded}.${sign(encoded)}`;
}

export function verifyParkingQrToken(input: string): ParkingQrPayload | null {
  const trimmed = input.trim();
  const token = trimmed.startsWith(`${QR_PREFIX}.`) ? trimmed : trimmed.replace(/^.*?(PARKFLOW\.)/, "$1");
  const [prefix, encoded, signature] = token.split(".");
  if (prefix !== QR_PREFIX || !encoded || !signature) return null;

  const expected = sign(encoded);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length || !crypto.timingSafeEqual(provided, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as ParkingQrPayload;
    if (!payload.sessionId || !payload.sessionCode || !payload.projectId) return null;
    return payload;
  } catch {
    return null;
  }
}
