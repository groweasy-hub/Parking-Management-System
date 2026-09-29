import { Schema, model, Types, Document } from "mongoose";

/**
 * Fast-read denormalized occupancy counter, one document per allocation.
 * parkingSessions remains the source of truth; this collection exists only
 * to make availability reads O(1) instead of a COUNT() aggregation on every
 * gate check. It can always be rebuilt from active sessions — see
 * services/reconciliationService.ts.
 */
export interface IOccupancy extends Document {
  projectId: Types.ObjectId;
  allocationId: Types.ObjectId;
  capacity: number;
  occupied: number;
  updatedAt: Date;
}

const occupancySchema = new Schema<IOccupancy>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    allocationId: { type: Schema.Types.ObjectId, ref: "ParkingAllocation", required: true },
    capacity: { type: Number, required: true, min: 0 },
    occupied: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

occupancySchema.index({ projectId: 1, allocationId: 1 }, { unique: true });

export const Occupancy = model<IOccupancy>("Occupancy", occupancySchema);
