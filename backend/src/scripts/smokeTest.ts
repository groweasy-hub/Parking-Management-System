/**
 * Self-contained concurrency/business-rule smoke test. Spins up a
 * single-node MongoDB replica set in memory (transactions require a
 * replica set), exercises the entry/exit services directly, and asserts
 * the mandatory business rules from the spec:
 *   - optional vehicle number (with and without)
 *   - duplicate active vehicle number is rejected
 *   - concurrent entry for the last slot: exactly one winner
 *   - concurrent exit of the same session: exactly one winner
 *
 * Run with: npm run smoke-test
 */
import { MongoMemoryReplSet } from "mongodb-memory-server";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}`, detail ?? "");
  }
}

async function main() {
  console.log("Starting single-node MongoDB replica set (required for transactions)...");
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  process.env.MONGODB_URI = replSet.getUri("parking_smoke_test");
  process.env.JWT_ACCESS_SECRET = "smoke-test-access-secret";
  process.env.JWT_REFRESH_SECRET = "smoke-test-refresh-secret";
  process.env.CORS_ORIGIN = "http://localhost:3000";
  process.env.NODE_ENV = "test";

  const { connectDB } = await import("../config/db.js");
  await connectDB();
  console.log("Connected to in-memory replica set.\n");

  const { Project, Floor, Company, ParkingAllocation, Occupancy, Gate, User, ParkingSession } = await import(
    "../models/index.js"
  );
  const { createEntry, completeExit } = await import("../services/parkingService.js");
  const { hashPassword } = await import("../utils/password.js");
  const { AppError } = await import("../utils/AppError.js");

  const project = await Project.create({ name: "Smoke Test Tower", code: "STT001", status: "ACTIVE" });
  const floor = await Floor.create({
    projectId: project._id,
    name: "B1",
    code: "B1",
    displayOrder: 1,
    status: "ACTIVE",
  });
  const company = await Company.create({ projectId: project._id, name: "Smoke Co", code: "SMK", status: "ACTIVE" });
  const entryGate = await Gate.create({ projectId: project._id, name: "Gate 1", type: "ENTRY", status: "ACTIVE" });
  const exitGate = await Gate.create({ projectId: project._id, name: "Gate 2", type: "EXIT", status: "ACTIVE" });
  const user = await User.create({
    name: "Tester",
    email: "tester@smoke.local",
    passwordHash: await hashPassword("x"),
    role: "ENTRY_GATEMAN",
    projectId: project._id,
    gateId: entryGate._id,
    status: "ACTIVE",
  });

  console.log("Test group 1: optional vehicle number");
  const alloc1 = await ParkingAllocation.create({
    projectId: project._id,
    companyId: company._id,
    floorId: floor._id,
    vehicleType: "CAR",
    capacity: 5,
    status: "ACTIVE",
  });
  await Occupancy.create({ projectId: project._id, allocationId: alloc1._id, capacity: 5, occupied: 0 });

  const withNumber = await createEntry({
    projectId: String(project._id),
    companyId: String(company._id),
    floorId: String(floor._id),
    vehicleType: "CAR",
    vehicleNumber: "TS09AB1234",
    entryGateId: String(entryGate._id),
    entryUserId: String(user._id),
  });
  check("entry with vehicle number succeeds and is ACTIVE", withNumber.session.status === "ACTIVE");

  const withoutNumber = await createEntry({
    projectId: String(project._id),
    companyId: String(company._id),
    floorId: String(floor._id),
    vehicleType: "CAR",
    vehicleNumber: null,
    entryGateId: String(entryGate._id),
    entryUserId: String(user._id),
  });
  check(
    "entry without vehicle number succeeds with vehicleNumber=null",
    withoutNumber.session.status === "ACTIVE" && withoutNumber.session.vehicleNumber === null
  );

  console.log("\nTest group 2: duplicate active vehicle number rejected");
  let duplicateRejected = false;
  try {
    await createEntry({
      projectId: String(project._id),
      companyId: String(company._id),
      floorId: String(floor._id),
      vehicleType: "CAR",
      vehicleNumber: "TS09AB1234",
      entryGateId: String(entryGate._id),
      entryUserId: String(user._id),
    });
  } catch (err) {
    duplicateRejected = err instanceof AppError && err.code === "VEHICLE_ALREADY_INSIDE";
  }
  check("duplicate active vehicle number is rejected", duplicateRejected);

  let secondNullOk = false;
  try {
    const r = await createEntry({
      projectId: String(project._id),
      companyId: String(company._id),
      floorId: String(floor._id),
      vehicleType: "CAR",
      vehicleNumber: null,
      entryGateId: String(entryGate._id),
      entryUserId: String(user._id),
    });
    secondNullOk = r.session.status === "ACTIVE";
  } catch {
    secondNullOk = false;
  }
  check("a second vehicle with no number is still allowed", secondNullOk);

  console.log("\nTest group 3: concurrent entry for the last remaining slot (spec section 55)");
  const alloc2 = await ParkingAllocation.create({
    projectId: project._id,
    companyId: company._id,
    floorId: floor._id,
    vehicleType: "BIKE",
    capacity: 20,
    status: "ACTIVE",
  });
  await Occupancy.create({ projectId: project._id, allocationId: alloc2._id, capacity: 20, occupied: 19 });

  const concurrentEntryResults = await Promise.allSettled([
    createEntry({
      projectId: String(project._id),
      companyId: String(company._id),
      floorId: String(floor._id),
      vehicleType: "BIKE",
      vehicleNumber: null,
      entryGateId: String(entryGate._id),
      entryUserId: String(user._id),
    }),
    createEntry({
      projectId: String(project._id),
      companyId: String(company._id),
      floorId: String(floor._id),
      vehicleType: "BIKE",
      vehicleNumber: null,
      entryGateId: String(entryGate._id),
      entryUserId: String(user._id),
    }),
  ]);

  const succeeded = concurrentEntryResults.filter((r) => r.status === "fulfilled");
  const rejected = concurrentEntryResults.filter((r) => r.status === "rejected");
  check("exactly one concurrent entry succeeds", succeeded.length === 1, concurrentEntryResults);
  check(
    "the other concurrent entry is rejected with PARKING_FULL",
    rejected.length === 1 &&
      rejected[0].status === "rejected" &&
      rejected[0].reason instanceof AppError &&
      rejected[0].reason.code === "PARKING_FULL"
  );

  const finalOccupancy = await Occupancy.findOne({ allocationId: alloc2._id }).lean();
  check("final occupied never exceeds capacity (20/20, not 21)", finalOccupancy?.occupied === 20, finalOccupancy);

  console.log("\nTest group 4: concurrent exit of the same session (spec section 56)");
  const toClose = await createEntry({
    projectId: String(project._id),
    companyId: String(company._id),
    floorId: String(floor._id),
    vehicleType: "CAR",
    vehicleNumber: "TS-EXIT-TEST",
    entryGateId: String(entryGate._id),
    entryUserId: String(user._id),
  });

  const concurrentExitResults = await Promise.allSettled([
    completeExit({ sessionId: String(toClose.session._id), exitGateId: String(exitGate._id), exitUserId: String(user._id) }),
    completeExit({ sessionId: String(toClose.session._id), exitGateId: String(exitGate._id), exitUserId: String(user._id) }),
  ]);
  const exitSucceeded = concurrentExitResults.filter((r) => r.status === "fulfilled");
  const exitRejected = concurrentExitResults.filter((r) => r.status === "rejected");
  check("exactly one concurrent exit succeeds", exitSucceeded.length === 1, concurrentExitResults);
  check(
    "the other concurrent exit is rejected as already completed",
    exitRejected.length === 1 &&
      exitRejected[0].status === "rejected" &&
      exitRejected[0].reason instanceof AppError &&
      exitRejected[0].reason.code === "SESSION_ALREADY_COMPLETED"
  );

  const finalSession = await ParkingSession.findById(toClose.session._id).lean();
  check("closed session status is COMPLETED exactly once", finalSession?.status === "COMPLETED");

  console.log(`\n${passed} passed, ${failed} failed`);
  await replSet.stop();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Smoke test crashed", err);
  process.exit(1);
});
