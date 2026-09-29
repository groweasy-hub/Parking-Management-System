import { Schema, model, Types, Document } from "mongoose";

export interface IAuditLog extends Document {
  userId: Types.ObjectId | null;
  projectId: Types.ObjectId | null;
  action: string;
  entityType: string;
  entityId: Types.ObjectId | null;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now },
});

auditLogSchema.index({ projectId: 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });

export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);
