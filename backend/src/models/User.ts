import { Schema, model, Types, Document } from "mongoose";
import { ROLES, Role, ENTITY_STATUSES, EntityStatus } from "../types/enums";

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: Role;
  projectId?: Types.ObjectId | null;
  gateId?: Types.ObjectId | null;
  status: EntityStatus;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    gateId: { type: Schema.Types.ObjectId, ref: "Gate", default: null },
    status: { type: String, enum: ENTITY_STATUSES, default: "ACTIVE" },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ projectId: 1 });

export const User = model<IUser>("User", userSchema);
