import { Schema, model, Types, Document } from "mongoose";
import { SESSION_STATUSES, SessionStatus, VEHICLE_TYPES, VehicleType } from "../types/enums";

export interface IParkingSession extends Document {
  sessionCode: string;
  projectId: Types.ObjectId;
  companyId: Types.ObjectId;
  floorId: Types.ObjectId;
  allocationId: Types.ObjectId;
  vehicleType: VehicleType;
  vehicleNumber: string | null;
  entryGateId: Types.ObjectId;
  entryUserId: Types.ObjectId;
  entryTime: Date;
  exitGateId: Types.ObjectId | null;
  exitUserId: Types.ObjectId | null;
  exitTime: Date | null;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const parkingSessionSchema = new Schema<IParkingSession>(
  {
    sessionCode: { type: String, required: true, unique: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    floorId: { type: Schema.Types.ObjectId, ref: "Floor", required: true },
    allocationId: { type: Schema.Types.ObjectId, ref: "ParkingAllocation", required: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    vehicleNumber: { type: String, default: null, uppercase: true, trim: true },
    entryGateId: { type: Schema.Types.ObjectId, ref: "Gate", required: true },
    entryUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    entryTime: { type: Date, required: true, default: Date.now },
    exitGateId: { type: Schema.Types.ObjectId, ref: "Gate", default: null },
    exitUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    exitTime: { type: Date, default: null },
    status: { type: String, enum: SESSION_STATUSES, required: true, default: "ACTIVE" },
  },
  { timestamps: true }
);

// Core operational indexes (see spec section 38).
parkingSessionSchema.index({ projectId: 1, status: 1 });
parkingSessionSchema.index({ projectId: 1, companyId: 1, status: 1 });
parkingSessionSchema.index({ projectId: 1, floorId: 1, status: 1 });
parkingSessionSchema.index({ projectId: 1, vehicleType: 1, status: 1 });
parkingSessionSchema.index({ projectId: 1, vehicleNumber: 1, status: 1 });
parkingSessionSchema.index({ entryTime: -1 });
parkingSessionSchema.index({ allocationId: 1, status: 1 });

// Enforces "only one ACTIVE session per vehicle number per project" at the
// database level as a last line of defense on top of the application check
// performed inside the entry transaction.
parkingSessionSchema.index(
  { projectId: 1, vehicleNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "ACTIVE", vehicleNumber: { $type: "string" } },
  }
);

export const ParkingSession = model<IParkingSession>("ParkingSession", parkingSessionSchema);
