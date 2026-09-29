import { Schema, model, Types, Document } from "mongoose";

export interface ISystemSettings extends Document {
  projectId: Types.ObjectId | null;
  key: string;
  value: unknown;
  updatedAt: Date;
}

const systemSettingsSchema = new Schema<ISystemSettings>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

systemSettingsSchema.index({ projectId: 1, key: 1 }, { unique: true });

export const SystemSettings = model<ISystemSettings>("SystemSettings", systemSettingsSchema);
