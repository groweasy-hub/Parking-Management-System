import { Schema, model, Types, Document } from "mongoose";
import { ENTITY_STATUSES, EntityStatus } from "../types/enums";

export interface IFloor extends Document {
  projectId: Types.ObjectId;
  name: string;
  code: string;
  displayOrder: number;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
}

const floorSchema = new Schema<IFloor>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    displayOrder: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ENTITY_STATUSES, default: "ACTIVE" },
  },
  { timestamps: true }
);

floorSchema.index({ projectId: 1, displayOrder: 1 });
floorSchema.index({ projectId: 1, code: 1 }, { unique: true });

export const Floor = model<IFloor>("Floor", floorSchema);
