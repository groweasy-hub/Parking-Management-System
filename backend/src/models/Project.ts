import { Schema, model, Document } from "mongoose";
import { ENTITY_STATUSES, EntityStatus } from "../types/enums";

export interface IProject extends Document {
  name: string;
  code: string;
  address?: string;
  /** Total building floors (e.g. office floors), excluding parking floors. */
  totalFloors?: number;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    address: { type: String, trim: true },
    totalFloors: { type: Number, min: 0 },
    status: { type: String, enum: ENTITY_STATUSES, default: "ACTIVE" },
  },
  { timestamps: true }
);

export const Project = model<IProject>("Project", projectSchema);
