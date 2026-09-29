/**
 * End-to-end HTTP smoke test: boots the real Express app (routes,
 * middleware, cookie auth) against an in-memory MongoDB replica set and
 * drives it purely over fetch(), the way the frontend does. Complements
 * smokeTest.ts, which calls the service layer directly and skips HTTP/auth.
 *
 * Run with: npm run smoke-test:http
 */
import { MongoMemoryReplSet } from "mongodb-memory-server";
import http from "http";

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

function extractCookies(res: Response, jar: Map<string, string>) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const [name, value] = pair.split("=");
    jar.set(name, value);
  }
}
function cookieHeader(jar: Map<string, string>) {
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function main() {
  console.log("Starting single-node MongoDB replica set...");
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri("parking_http_smoke");
  process.env.JWT_ACCESS_SECRET = "http-smoke-access";
  process.env.JWT_REFRESH_SECRET = "http-smoke-refresh";
  process.env.CORS_ORIGIN = "http://localhost:3000";
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";

  const { connectDB } = await import("../config/db.js");
  await connectDB();
  const { createApp } = await import("../app.js");
  const { User, Project, Floor, Company, ParkingAllocation, Occupancy, Gate } = await import("../models/index.js");
  const { hashPassword } = await import("../utils/password.js");

  const project = await Project.create({ name: "HTTP Smoke Tower", code: "HST001", status: "ACTIVE" });
  const floor = await Floor.create({ projectId: project._id, name: "B1", code: "B1", displayOrder: 1, status: "ACTIVE" });
  const company = await Company.create({ projectId: project._id, name: "HTTP Co", code: "HTC", status: "ACTIVE" });
  const entryGate = await Gate.create({ projectId: project._id, name: "Gate 1", type: "ENTRY", status: "ACTIVE" });
  const exitGate = await Gate.create({ projectId: project._id, name: "Gate 2", type: "EXIT", status: "ACTIVE" });
  const allocation = await ParkingAllocation.create({
    projectId: project._id,
    companyId: company._id,
    floorId: floor._id,
    vehicleType: "CAR",
    capacity: 2,
    status: "ACTIVE",
  });
  await Occupancy.create({ projectId: project._id, allocationId: allocation._id, capacity: 2, occupied: 0 });

  const entryUser = await User.create({
    name: "HTTP Entry",
    email: "httpentry@smoke.local",
    passwordHash: await hashPassword("Password123!"),
    role: "ENTRY_GATEMAN",
    projectId: project._id,
    gateId: entryGate._id,
    status: "ACTIVE",
  });
  await User.create({
    name: "HTTP Exit",
    email: "httpexit@smoke.local",
    passwordHash: await hashPassword("Password123!"),
    role: "EXIT_GATEMAN",
    projectId: project._id,
    gateId: exitGate._id,
    status: "ACTIVE",
  });

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;

  // --- Login as entry gateman ---
  const jar = new Map<string, string>();
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: entryUser.email, password: "Password123!" }),
  });
  extractCookies(loginRes, jar);
  const loginBody = (await loginRes.json()) as { user: { role: string } };
  check("login returns 200 and correct role", loginRes.status === 200 && loginBody.user.role === "ENTRY_GATEMAN");
  check("login sets an accessToken cookie", jar.has("accessToken"));

  // --- Unauthenticated request is rejected ---
  const unauthedRes = await fetch(`${base}/api/parking/active?projectId=${project._id}`);
  check("request without cookie is rejected with 401", unauthedRes.status === 401);

  // --- Wrong password rejected without leaking which field was wrong ---
  const badLoginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: entryUser.email, password: "wrong" }),
  });
  check("wrong password rejected with 401", badLoginRes.status === 401);

  // --- Availability check ---
  const availRes = await fetch(
    `${base}/api/parking/availability?projectId=${project._id}&companyId=${company._id}&vehicleType=CAR`,
    { headers: { Cookie: cookieHeader(jar) } }
  );
  const availBody = (await availRes.json()) as { allocations: { available: number }[] };
  check(
    "availability endpoint reports 2 available before any entry",
    availRes.status === 200 && availBody.allocations[0]?.available === 2,
    availBody
  );

  // --- Create an entry over HTTP ---
  const entryRes = await fetch(`${base}/api/parking/entry`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(jar) },
    body: JSON.stringify({
      projectId: String(project._id),
      companyId: String(company._id),
      floorId: String(floor._id),
      vehicleType: "CAR",
      vehicleNumber: "HTTP01",
      entryGateId: String(entryGate._id),
    }),
  });
  const entryBody = (await entryRes.json()) as { session: { sessionCode: string; status: string }; availability: { available: number } };
  check(
    "entry over HTTP succeeds and returns updated availability",
    entryRes.status === 201 && entryBody.session.status === "ACTIVE" && entryBody.availability.available === 1,
    entryBody
  );

  // --- Role enforcement: entry gateman cannot hit exit endpoint ---
  const activeRes = await fetch(`${base}/api/parking/active?projectId=${project._id}`, {
    headers: { Cookie: cookieHeader(jar) },
  });
  const activeBody = (await activeRes.json()) as { sessions: { _id: string }[] };
  const sessionId = activeBody.sessions[0]?._id;
  const wrongRoleExitRes = await fetch(`${base}/api/parking/exit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(jar) },
    body: JSON.stringify({ sessionId, exitGateId: String(exitGate._id) }),
  });
  check("entry gateman is forbidden from exiting a vehicle", wrongRoleExitRes.status === 403);

  // --- Login as exit gateman and actually exit ---
  const exitJar = new Map<string, string>();
  const exitLoginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "httpexit@smoke.local", password: "Password123!" }),
  });
  extractCookies(exitLoginRes, exitJar);

  const exitRes = await fetch(`${base}/api/parking/exit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(exitJar) },
    body: JSON.stringify({ sessionId, exitGateId: String(exitGate._id) }),
  });
  const exitBody = (await exitRes.json()) as { session: { status: string }; availability: { available: number } };
  check(
    "exit gateman completes the exit and availability is released",
    exitRes.status === 200 && exitBody.session.status === "COMPLETED" && exitBody.availability.available === 2,
    exitBody
  );

  // --- Cross-project access denied ---
  const otherProject = await Project.create({ name: "Other Tower", code: "OTH001", status: "ACTIVE" });
  const crossRes = await fetch(`${base}/api/parking/active?projectId=${otherProject._id}`, {
    headers: { Cookie: cookieHeader(jar) },
  });
  check("gateman cannot query a project they are not assigned to", crossRes.status === 403, await crossRes.text());

  console.log(`\n${passed} passed, ${failed} failed`);
  server.close();
  await replSet.stop();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("HTTP smoke test crashed", err);
  process.exit(1);
});
