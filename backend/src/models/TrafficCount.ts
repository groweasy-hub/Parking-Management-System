import { Schema, model, Types, Document } from "mongoose";

export interface ITrafficCount extends Document {
  projectId: Types.ObjectId;
  companyId: Types.ObjectId;
  floorId: Types.ObjectId;
  vehicleType: string;
  date: string;
  entries: number;
  exits: number;
}

const schema = new Schema<ITrafficCount>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
  floorId: { type: Schema.Types.ObjectId, ref: "Floor", required: true },
  vehicleType: { type: String, required: true },
  date: { type: String, required: true },
  entries: { type: Number, default: 0 },
  exits: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ projectId: 1, companyId: 1, floorId: 1, vehicleType: 1, date: 1 }, { unique: true });
export const TrafficCount = model<ITrafficCount>("TrafficCount", schema);
