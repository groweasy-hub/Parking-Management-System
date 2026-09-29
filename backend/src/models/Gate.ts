import { Schema, model, Types, Document } from "mongoose";
import { ENTITY_STATUSES, EntityStatus, GATE_TYPES, GateType } from "../types/enums";

export interface IGate extends Document {
  projectId: Types.ObjectId;
  name: string;
  type: GateType;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
}

const gateSchema = new Schema<IGate>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: GATE_TYPES, required: true },
    status: { type: String, enum: ENTITY_STATUSES, default: "ACTIVE" },
  },
  { timestamps: true }
);

gateSchema.index({ projectId: 1, type: 1 });

export const Gate = model<IGate>("Gate", gateSchema);
