import { Schema, model, Types, Document } from "mongoose";
import { GateType } from "../types/enums";

export interface IGateDuty extends Document {
  userId: Types.ObjectId;
  projectId: Types.ObjectId;
  gateId: Types.ObjectId;
  gateType: GateType;
  dutyDate: string;
  startedAt: Date;
  endedAt?: Date | null;
  entryCount: number;
  exitCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const gateDutySchema = new Schema<IGateDuty>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    gateId: { type: Schema.Types.ObjectId, ref: "Gate", required: true },
    gateType: { type: String, enum: ["ENTRY", "EXIT"], required: true },
    dutyDate: { type: String, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    entryCount: { type: Number, default: 0 },
    exitCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

gateDutySchema.index({ userId: 1, dutyDate: 1 }, { unique: true });
gateDutySchema.index({ projectId: 1, dutyDate: 1 });

export const GateDuty = model<IGateDuty>("GateDuty", gateDutySchema);
