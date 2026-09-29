export const ROLES = [
  "SUPER_ADMIN",
  "PROJECT_ADMIN",
  "ENTRY_GATEMAN",
  "EXIT_GATEMAN",
  "VIEWER",
] as const;
export type Role = (typeof ROLES)[number];

export const VEHICLE_TYPES = ["CAR", "BIKE", "OTHER"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const GATE_TYPES = ["ENTRY", "EXIT"] as const;
export type GateType = (typeof GATE_TYPES)[number];

export const SESSION_STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const ENTITY_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export const AVAILABILITY_STATUSES = ["AVAILABLE", "LIMITED", "FULL"] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];
