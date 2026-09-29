import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { User, Project, Floor, Company, ParkingAllocation, Gate, Occupancy } from "../models";
import { hashPassword } from "../utils/password";
import { env } from "../config/env";

async function upsertProject() {
  return Project.findOneAndUpdate(
    { code: "HBT001" },
    {
      $setOnInsert: {
        name: "Hyderabad Business Tower",
        code: "HBT001",
        address: "Hyderabad, Telangana",
        status: "ACTIVE",
      },
    },
    { upsert: true, new: true }
  );
}

async function upsertFloor(projectId: mongoose.Types.ObjectId, name: string, code: string, displayOrder: number) {
  return Floor.findOneAndUpdate(
    { projectId, code },
    { $setOnInsert: { projectId, name, code, displayOrder, status: "ACTIVE" } },
    { upsert: true, new: true }
  );
}

async function upsertCompany(projectId: mongoose.Types.ObjectId, name: string, code: string) {
  return Company.findOneAndUpdate(
    { projectId, code },
    { $setOnInsert: { projectId, name, code, status: "ACTIVE" } },
    { upsert: true, new: true }
  );
}

async function upsertAllocation(
  projectId: mongoose.Types.ObjectId,
  companyId: mongoose.Types.ObjectId,
  floorId: mongoose.Types.ObjectId,
  vehicleType: "CAR" | "BIKE" | "OTHER",
  capacity: number,
  preferred = false
) {
  const allocation = await ParkingAllocation.findOneAndUpdate(
    { projectId, companyId, floorId, vehicleType },
    { $setOnInsert: { projectId, companyId, floorId, vehicleType, capacity, preferred, status: "ACTIVE" } },
    { upsert: true, new: true }
  );
  await Occupancy.findOneAndUpdate(
    { allocationId: allocation._id },
    { $setOnInsert: { projectId, allocationId: allocation._id, capacity, occupied: 0 } },
    { upsert: true }
  );
  return allocation;
}

async function upsertGate(projectId: mongoose.Types.ObjectId, name: string, type: "ENTRY" | "EXIT") {
  return Gate.findOneAndUpdate(
    { projectId, name },
    { $setOnInsert: { projectId, name, type, status: "ACTIVE" } },
    { upsert: true, new: true }
  );
}

async function upsertUser(params: {
  name: string;
  email: string;
  password: string;
  role: "SUPER_ADMIN" | "PROJECT_ADMIN" | "ENTRY_GATEMAN" | "EXIT_GATEMAN" | "VIEWER";
  projectId?: mongoose.Types.ObjectId | null;
  gateId?: mongoose.Types.ObjectId | null;
}) {
  const existing = await User.findOne({ email: params.email });
  if (existing) return existing;
  const passwordHash = await hashPassword(params.password);
  return User.create({
    name: params.name,
    email: params.email,
    passwordHash,
    role: params.role,
    projectId: params.projectId ?? null,
    gateId: params.gateId ?? null,
    status: "ACTIVE",
  });
}

async function main() {
  await connectDB();
  console.log("[seed] Connected to MongoDB");

  const superAdmin = await upsertUser({
    name: "Super Admin",
    email: env.seed.superAdminEmail,
    password: env.seed.superAdminPassword,
    role: "SUPER_ADMIN",
  });
  console.log(`[seed] Super admin ready: ${superAdmin.email}`);

  const project = await upsertProject();
  console.log(`[seed] Project ready: ${project.name} (${project.code})`);

  const [b1, b2, b3] = await Promise.all([
    upsertFloor(project._id as mongoose.Types.ObjectId, "Basement 1", "B1", 1),
    upsertFloor(project._id as mongoose.Types.ObjectId, "Basement 2", "B2", 2),
    upsertFloor(project._id as mongoose.Types.ObjectId, "Basement 3", "B3", 3),
  ]);

  const [abc, xyz, pqr] = await Promise.all([
    upsertCompany(project._id as mongoose.Types.ObjectId, "ABC Technologies", "ABC"),
    upsertCompany(project._id as mongoose.Types.ObjectId, "XYZ Solutions", "XYZ"),
    upsertCompany(project._id as mongoose.Types.ObjectId, "PQR Systems", "PQR"),
  ]);

  await upsertAllocation(project._id as mongoose.Types.ObjectId, abc._id as mongoose.Types.ObjectId, b1._id as mongoose.Types.ObjectId, "CAR", 20, true);
  await upsertAllocation(project._id as mongoose.Types.ObjectId, abc._id as mongoose.Types.ObjectId, b1._id as mongoose.Types.ObjectId, "BIKE", 50, true);
  await upsertAllocation(project._id as mongoose.Types.ObjectId, abc._id as mongoose.Types.ObjectId, b2._id as mongoose.Types.ObjectId, "CAR", 10, false);
  await upsertAllocation(project._id as mongoose.Types.ObjectId, xyz._id as mongoose.Types.ObjectId, b1._id as mongoose.Types.ObjectId, "CAR", 15, true);
  await upsertAllocation(project._id as mongoose.Types.ObjectId, xyz._id as mongoose.Types.ObjectId, b2._id as mongoose.Types.ObjectId, "BIKE", 30, true);
  await upsertAllocation(project._id as mongoose.Types.ObjectId, pqr._id as mongoose.Types.ObjectId, b2._id as mongoose.Types.ObjectId, "CAR", 25, true);
  await upsertAllocation(project._id as mongoose.Types.ObjectId, pqr._id as mongoose.Types.ObjectId, b3._id as mongoose.Types.ObjectId, "CAR", 5, false);
  console.log("[seed] Parking allocations ready");

  const gate1 = await upsertGate(project._id as mongoose.Types.ObjectId, "Gate 1", "ENTRY");
  await upsertGate(project._id as mongoose.Types.ObjectId, "Gate 2", "ENTRY");
  const gate3 = await upsertGate(project._id as mongoose.Types.ObjectId, "Gate 3", "EXIT");
  console.log("[seed] Gates ready");

  await upsertUser({
    name: "Project Admin",
    email: "projectadmin@parking.local",
    password: "ChangeMe123!",
    role: "PROJECT_ADMIN",
    projectId: project._id as mongoose.Types.ObjectId,
  });
  await upsertUser({
    name: "Entry Gateman",
    email: "entry@parking.local",
    password: "ChangeMe123!",
    role: "ENTRY_GATEMAN",
    projectId: project._id as mongoose.Types.ObjectId,
    gateId: gate1._id as mongoose.Types.ObjectId,
  });
  await upsertUser({
    name: "Exit Gateman",
    email: "exit@parking.local",
    password: "ChangeMe123!",
    role: "EXIT_GATEMAN",
    projectId: project._id as mongoose.Types.ObjectId,
    gateId: gate3._id as mongoose.Types.ObjectId,
  });
  await upsertUser({
    name: "Viewer",
    email: "viewer@parking.local",
    password: "ChangeMe123!",
    role: "VIEWER",
    projectId: project._id as mongoose.Types.ObjectId,
  });
  console.log("[seed] Demo users ready");

  console.log("\n--- Demo credentials (change these before production) ---");
  console.log(`Super Admin:    ${env.seed.superAdminEmail} / ${env.seed.superAdminPassword}`);
  console.log("Project Admin:  projectadmin@parking.local / ChangeMe123!");
  console.log("Entry Gateman:  entry@parking.local / ChangeMe123!");
  console.log("Exit Gateman:   exit@parking.local / ChangeMe123!");
  console.log("Viewer:         viewer@parking.local / ChangeMe123!");

  await mongoose.disconnect();
  console.log("[seed] Done.");
}

main().catch((err) => {
  console.error("[seed] Failed", err);
  process.exit(1);
});
