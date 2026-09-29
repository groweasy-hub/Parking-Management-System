export const ROLES = [
  "SUPER_ADMIN",
  "PROJECT_ADMIN",
  "GATEKEEPER",
  "VIEWER",
] as const;
export type Role = (typeof ROLES)[number];

export const VEHICLE_TYPES = ["CAR", "BIKE", "OTHER"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export type GateType = "ENTRY" | "EXIT";
export type EntityStatus = "ACTIVE" | "INACTIVE";
export type SessionStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";
export type AvailabilityStatus = "AVAILABLE" | "LIMITED" | "FULL";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  mustChangePassword?: boolean;
  projectId: string | null;
  gateId: string | null;
}

export interface Project {
  _id: string;
  name: string;
  code: string;
  address?: string;
  /** Total building floors (offices etc.), excluding parking floors. */
  totalFloors?: number;
  status: EntityStatus;
  createdAt: string;
}

export interface Floor {
  _id: string;
  projectId: string;
  name: string;
  code: string;
  displayOrder: number;
  carCapacity: number;
  bikeCapacity: number;
  otherCapacity: number;
  status: EntityStatus;
}

export interface Company {
  _id: string;
  projectId: string;
  name: string;
  code: string;
  /** The building floor the company's office is on — NOT a parking floor. */
  officeFloor?: string;
  email?: string;
  phone?: string;
  serviceType?: string;
  address?: string;
  logoUrl?: string;
  status: EntityStatus;
}

export interface ParkingAllocation {
  _id: string;
  projectId: string;
  companyId: string;
  floorId: string;
  vehicleType: VehicleType;
  capacity: number;
  occupied?: number;
  preferred: boolean;
  status: EntityStatus;
}

export interface Gate {
  _id: string;
  projectId: string;
  name: string;
  type: GateType;
  status: EntityStatus;
}

export interface AppUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  customRoleLabel?: string;
  projectId: string | null;
  gateId: string | null;
  status: EntityStatus;
  createdAt: string;
}

export interface AllocationAvailability {
  allocationId: string;
  floorId: string;
  floorName: string;
  floorCode: string;
  vehicleType: VehicleType;
  capacity: number;
  occupied: number;
  available: number;
  status: AvailabilityStatus;
  preferred: boolean;
}

export interface ParkingSessionRecord {
  _id: string;
  sessionCode: string;
  projectId: string;
  companyId: { _id: string; name: string; logoUrl?: string } | string;
  floorId: { _id: string; name: string; code: string } | string;
  vehicleType: VehicleType;
  vehicleNumber: string | null;
  entryGateId: { _id: string; name: string } | string;
  entryTime: string;
  exitGateId: { _id: string; name: string } | string | null;
  exitTime: string | null;
  status: SessionStatus;
}

export interface AuditLogEntry {
  _id: string;
  userId: { _id: string; name: string; email: string; role: Role } | null;
  projectId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}
