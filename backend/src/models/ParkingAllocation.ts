import { Schema, model, Types, Document } from "mongoose";
import { ENTITY_STATUSES, EntityStatus, VEHICLE_TYPES, VehicleType } from "../types/enums";

export interface IParkingAllocation extends Document {
  projectId: Types.ObjectId;
  companyId: Types.ObjectId;
  floorId: Types.ObjectId;
  vehicleType: VehicleType;
  capacity: number;
  preferred: boolean;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
}

const parkingAllocationSchema = new Schema<IParkingAllocation>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    floorId: { type: Schema.Types.ObjectId, ref: "Floor", required: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    capacity: { type: Number, required: true, min: 0 },
    preferred: { type: Boolean, default: false },
    status: { type: String, enum: ENTITY_STATUSES, default: "ACTIVE" },
  },
  { timestamps: true }
);

// A company can only have one allocation per floor+vehicleType.
parkingAllocationSchema.index(
  { projectId: 1, companyId: 1, floorId: 1, vehicleType: 1 },
  { unique: true }
);
parkingAllocationSchema.index({ projectId: 1, companyId: 1, vehicleType: 1, status: 1 });
parkingAllocationSchema.index({ projectId: 1, floorId: 1, status: 1 });

export const ParkingAllocation = model<IParkingAllocation>(
  "ParkingAllocation",
  parkingAllocationSchema
);
