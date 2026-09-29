import { Schema, model, Types, Document } from "mongoose";
import { ENTITY_STATUSES, EntityStatus } from "../types/enums";

export interface ICompany extends Document {
  projectId: Types.ObjectId;
  name: string;
  code: string;
  /** The building floor the company's office occupies — NOT a parking floor. */
  officeFloor?: string;
  email?: string;
  phone?: string;
  serviceType?: string;
  address?: string;
  logoUrl?: string;
  logoStorageId?: string;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    officeFloor: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    serviceType: { type: String, trim: true },
    address: { type: String, trim: true },
    logoUrl: { type: String },
    logoStorageId: { type: String },
    status: { type: String, enum: ENTITY_STATUSES, default: "ACTIVE" },
  },
  { timestamps: true }
);

companySchema.index({ projectId: 1, name: 1 });
companySchema.index({ projectId: 1, code: 1 }, { unique: true });

export const Company = model<ICompany>("Company", companySchema);
