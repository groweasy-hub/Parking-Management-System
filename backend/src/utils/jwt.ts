import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { env } from "../config/env";
import { Role } from "../types/enums";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  projectId: string | null;
  gateId: string | null;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl as jwt.SignOptions["expiresIn"] });
}

export function signRefreshToken(userId: Types.ObjectId | string): string {
  return jwt.sign({ sub: String(userId) }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.jwt.refreshSecret) as { sub: string };
}
