import { ClientSession, Types } from "mongoose";
import { AuditLog } from "../models";

export interface AuditEntry {
  userId?: string | null;
  projectId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | Types.ObjectId | null;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(entry: AuditEntry, session?: ClientSession): Promise<void> {
  await AuditLog.create(
    [
      {
        userId: entry.userId ?? null,
        projectId: entry.projectId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? {},
        timestamp: new Date(),
      },
    ],
    { session }
  );
}
