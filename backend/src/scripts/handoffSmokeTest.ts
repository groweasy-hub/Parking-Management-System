import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

type Actor = { accessToken: string; refreshCookie: string };
type Entity = { _id: string; id: string };
type TestBody = {
  accessToken: string;
  project: Entity;
  floor: Entity;
  company: Entity;
  gate: Entity;
  allocation: Entity;
  user: Entity & { mustChangePassword: boolean };
  session: Entity & { vehicleNumber: string | null; qrToken: string; sessionCode: string };
  duty: { endedAt: string | null };
  totalOccupied: number;
  days: { date: string; entries: number; exits: number; duty: { entryCount: number } }[];
  sampledSessions: number;
  peakOccupancy: number;
  total: number;
  corrected: number;
};
let checks = 0;
function check(name: string, condition: unknown) {
  assert(condition, name);
  checks++;
  console.log(`PASS: ${name}`);
}

async function main() {
  const database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }] });
  let server: http.Server | undefined;
  let socketServer: import("socket.io").Server | undefined;
  try {
    process.env.MONGODB_URI = database.getUri("handoff_review");
    process.env.JWT_ACCESS_SECRET = "handoff-test-access";
    process.env.JWT_REFRESH_SECRET = "handoff-test-refresh";
    process.env.NODE_ENV = "test";
    process.env.APP_TIMEZONE = "Asia/Kolkata";
    process.env.PASSWORD_RESET_WEBHOOK_URL = "";
    process.env.CLOUDINARY_CLOUD_NAME = "";
    const { createApp } = await import("../app.js");
    const { initSocketServer } = await import("../realtime/socketServer.js");
    const { connectDB } = await import("../config/db.js");
    const { User, ParkingSession, Occupancy, GateDuty, Project, Floor, Company, ParkingAllocation, Gate } = await import("../models/index.js");
    const { hashPassword } = await import("../utils/password.js");
    const { businessDateKey, parseDateBoundary } = await import("../utils/dates.js");
    const { recordFailedLogin, clearFailedLogin, isAccountLocked } = await import("../services/authSecurityService.js");
    await connectDB();
    await Promise.all([User.init(), ParkingSession.init(), Occupancy.init(), GateDuty.init(), Floor.init(), ParkingAllocation.init()]);
    await User.create({ name: "Handoff Admin", email: "handoff-admin@example.com", role: "SUPER_ADMIN", passwordHash: await hashPassword("ReviewPass123!") });
    server = http.createServer(createApp());
    socketServer = initSocketServer(server);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    // Return objects from the real HTTP JSON protocol; assertions below check their fields.
    async function api(actor: Actor | null, method: string, path: string, data?: unknown,
      status = method === "POST" && ["/projects", "/floors", "/companies", "/gates", "/users", "/parking-allocations"].includes(path) ? 201 : 200) {
      const response = await fetch(`${base}/api${path}`, {
        method, headers: { "Content-Type": "application/json", ...(actor ? { Authorization: `Bearer ${actor.accessToken}` } : {}) },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
      const body = await response.json() as TestBody;
      assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(body)}`);
      checks++;
      return { body, response };
    }
    async function login(email: string, password = "ReviewPass123!"): Promise<Actor> {
      const { body, response } = await api(null, "POST", "/auth/login", { email, password });
      return { accessToken: body.accessToken, refreshCookie: response.headers.getSetCookie().find((cookie) => cookie.startsWith("refreshToken="))!.split(";")[0] };
    }
    const admin = await login("handoff-admin@example.com");
    await api(null, "GET", "/projects", undefined, 401);
    const project = (await api(admin, "POST", "/projects", { name: "Handoff Tower", totalFloors: 5 })).body.project;
    const otherProject = (await api(admin, "POST", "/projects", { name: "Other Tower" })).body.project;
    const projectId = project._id;
    const floor = (await api(admin, "POST", "/floors", { projectId, name: "Basement One", code: "B1", carCapacity: 3, bikeCapacity: 2 })).body.floor;
    const company = (await api(admin, "POST", "/companies", { projectId, name: "Review Company", officeFloor: "3" })).body.company;
    const company2 = (await api(admin, "POST", "/companies", { projectId, name: "Second Company" })).body.company;
    const foreignCompany = (await api(admin, "POST", "/companies", { projectId: otherProject._id, name: "Foreign Company" })).body.company;
    const entryGate = (await api(admin, "POST", "/gates", { projectId, name: "Entry Lane", type: "ENTRY" })).body.gate;
    const exitGate = (await api(admin, "POST", "/gates", { projectId, name: "Exit Lane", type: "EXIT" })).body.gate;
    const allocPayload = { projectId, floorId: floor._id, companyId: company._id, vehicleType: "CAR", capacity: 2 };
    const allocation = (await api(admin, "POST", "/parking-allocations", allocPayload, 201)).body.allocation;
    await api(admin, "POST", "/parking-allocations", allocPayload, 409);
    await api(admin, "POST", "/parking-allocations", { ...allocPayload, companyId: foreignCompany._id, vehicleType: "BIKE", capacity: 1 }, 400);
    await api(admin, "PATCH", `/floors/${floor._id}`, { carCapacity: 1 }, 400);

    // The last floor space cannot be allocated to two companies concurrently.
    const company3 = (await api(admin, "POST", "/companies", { projectId, name: "Third Company" })).body.company;
    const races = await Promise.all([company2, company3].map((item) => fetch(`${base}/api/parking-allocations`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin.accessToken}` },
      body: JSON.stringify({ ...allocPayload, companyId: item._id, capacity: 1 }),
    })));
    check("concurrent floor allocation respects physical capacity", races.filter((response) => response.status === 201).length === 1 && races.filter((response) => response.status === 400).length === 1);

    const makeUser = async (name: string, role: string) => (await api(admin, "POST", "/users", {
      projectId, name, email: `${name}@example.com`, role, password: "ReviewPass123!", phone: "9876543210",
    }, 201)).body.user;
    const managerUser = await makeUser("manager", "PROJECT_ADMIN");
    const viewerUser = await makeUser("viewer", "VIEWER");
    const entryUser = await makeUser("entry", "GATEKEEPER");
    await makeUser("exit", "GATEKEEPER");
    const manager = await login("manager@example.com");
    const viewer = await login("viewer@example.com");
    // Exercise Socket.IO over its real polling protocol without a browser dependency.
    const handshake = await (await fetch(`${base}/socket.io/?EIO=4&transport=polling`)).text();
    const engineId = (JSON.parse(handshake.slice(1)) as { sid: string }).sid;
    const socketUrl = `${base}/socket.io/?EIO=4&transport=polling&sid=${engineId}`;
    const sendPacket = (packet: string) => fetch(socketUrl, { method: "POST", headers: { "Content-Type": "text/plain" }, body: packet });
    await sendPacket(`40${JSON.stringify({ token: viewer.accessToken })}`);
    check("realtime connection accepts authenticated users", (await (await fetch(socketUrl)).text()).includes("40"));
    await sendPacket(`42${JSON.stringify(["join:project", otherProject._id])}`);
    check("realtime denies another project's room", (await socketServer.fetchSockets()).every((socket) => !socket.rooms.has(`project:${otherProject._id}`)));
    await sendPacket(`42${JSON.stringify(["join:project", projectId])}`);
    check("realtime joins the user's assigned project", (await socketServer.fetchSockets()).some((socket) => socket.rooms.has(`project:${projectId}`)));
    const entry = await login("entry@example.com");
    const exit = await login("exit@example.com");
    await api(manager, "GET", `/projects/${otherProject._id}`, undefined, 403);
    await api(manager, "PATCH", `/users/${managerUser.id}`, { password: "Escalation123!" }, 403);
    await api(viewer, "POST", "/gates", { projectId, name: "Blocked", type: "ENTRY" }, 403);
    await api(viewer, "GET", `/dashboard/summary?projectId=${projectId}`);
    await api(entry, "GET", `/parking/active?projectId=${otherProject._id}`, undefined, 403);
    await api(admin, "GET", "/floors/not-an-id", undefined, 404);
    await api(admin, "PATCH", "/floors/not-an-id", { name: "Invalid" }, 400);
    await api(admin, "GET", "/reports/entries-exits?projectId=invalid", undefined, 400);
    await api(admin, "GET", `/companies?projectId=${projectId}&search=%5B`);

    const oldEntryToken = entry.accessToken;
    await api(exit, "POST", "/gate-duty/start", { projectId, gateId: exitGate._id }, 403);
    const exitPassword = await api(exit, "POST", "/auth/change-password", { oldPassword: "ReviewPass123!", newPassword: "ExitUpdated123!" });
    exit.accessToken = exitPassword.body.accessToken;
    const oldEntryRefresh = entry.refreshCookie;
    const changed = await api(entry, "POST", "/auth/change-password", { oldPassword: "ReviewPass123!", newPassword: "UpdatedPass123!" });
    entry.accessToken = changed.body.accessToken;
    check("forced password change completes", changed.body.user.mustChangePassword === false);
    await api({ ...entry, accessToken: oldEntryToken }, "GET", "/auth/me", undefined, 401);
    check("old refresh token is revoked after password change", (await fetch(`${base}/api/auth/refresh`, { method: "POST", headers: { Cookie: oldEntryRefresh } })).status === 401);
    await api(entry, "GET", "/auth/me");
    const entryData = { projectId, companyId: company._id, floorId: floor._id, vehicleType: "CAR", vehicleNumber: "TS 01 AB 1234", entryGateId: entryGate._id };
    await api(entry, "POST", "/parking/entry", entryData, 403);
    await api(entry, "POST", "/gate-duty/start", { projectId, gateId: entryGate._id }, 201);
    await api(admin, "PATCH", `/gates/${entryGate._id}`, { type: "EXIT" }, 400);
    await api(entry, "POST", "/gate-duty/start", { projectId, gateId: exitGate._id }, 409);
    const first = (await api(entry, "POST", "/parking/entry", entryData, 201)).body.session;
    const entryEvents = await (await fetch(socketUrl, { signal: AbortSignal.timeout(5000) })).text();
    check("entries broadcast live availability and session updates", entryEvents.includes("availability:update") && entryEvents.includes("session:entry"));
    check("entry receipt has normalized plate and signed QR", first.vehicleNumber === "TS01AB1234" && Boolean(first.qrToken));
    await api(entry, "POST", "/parking/entry", entryData, 409);
    const second = (await api(entry, "POST", "/parking/entry", { ...entryData, vehicleNumber: null }, 201)).body.session;
    await api(entry, "POST", "/parking/entry", { ...entryData, vehicleNumber: null }, 409);
    await api(admin, "PATCH", `/parking-allocations/${allocation._id}`, { capacity: 1 }, 400);
    await api(admin, "PATCH", `/parking-allocations/${allocation._id}`, { status: "INACTIVE" }, 400);
    await api(entry, "POST", "/gate-duty/end");
    await api(entry, "POST", "/parking/entry", { ...entryData, vehicleNumber: null }, 403);
    await api(entry, "POST", "/gate-duty/start", { projectId, gateId: entryGate._id }, 201);
    check("ended duty can be resumed", !(await api(entry, "GET", "/gate-duty/today")).body.duty.endedAt);
    await api(exit, "POST", "/gate-duty/start", { projectId, gateId: exitGate._id }, 201);
    const qr = (await api(exit, "GET", `/parking/qr?token=${encodeURIComponent(first.qrToken)}`)).body.session;
    check("signed QR identifies the active vehicle", qr._id === first.id);
    await api(exit, "GET", `/parking/qr?token=${first.sessionCode}`);
    await api(exit, "GET", "/parking/qr?token=tampered", undefined, 400);
    await api(exit, "POST", "/parking/exit", { sessionId: first.id, exitGateId: exitGate._id });
    await api(exit, "POST", "/parking/exit", { sessionId: first.id, exitGateId: exitGate._id }, 409);
    await api(exit, "POST", "/parking/exit", { sessionId: second.id, exitGateId: exitGate._id });
    const exitEvents = await (await fetch(socketUrl, { signal: AbortSignal.timeout(5000) })).text();
    check("exits broadcast live session updates", exitEvents.includes("session:exit"));
    await api(exit, "GET", `/parking/qr?token=${first.sessionCode}`, undefined, 404);
    const summary = (await api(viewer, "GET", `/dashboard/summary?projectId=${projectId}`)).body;
    check("exits release both parking spaces", summary.totalOccupied === 0);

    const today = businessDateKey();
    const query = `projectId=${projectId}&companyId=${company._id}&from=${today}&to=${today}`;
    const report = (await api(viewer, "GET", `/reports/entries-exits?${query}`)).body;
    check("same-day reports include entries and exits", report.days.reduce((total: number, day: { entries: number }) => total + day.entries, 0) === 2 && report.days.reduce((total: number, day: { exits: number }) => total + day.exits, 0) === 2);
    const duration = (await api(viewer, "GET", `/reports/average-duration?${query}`)).body;
    check("average-duration aggregation matches completed sessions", duration.sampledSessions === 2);
    const peak = (await api(viewer, "GET", `/reports/peak-occupancy?${query}`)).body;
    check("peak occupancy reports two simultaneous parked vehicles", peak.peakOccupancy === 2);
    await api(viewer, "GET", `/reports/utilization?${query}`);
    await api(viewer, "GET", `/reports/entries-exits?projectId=${projectId}&from=2026-02-31&to=${today}`, undefined, 400);
    await api(viewer, "GET", `/reports/entries-exits?projectId=${projectId}&from=2026-12-31&to=2026-01-01`, undefined, 400);
    const history = (await api(viewer, "GET", `/parking/history?projectId=${projectId}&vehicleNumber=TS01&entryDateFrom=${today}&entryDateTo=${today}`)).body;
    check("history respects plate and full-day date filters", history.total === 1);
    const csv = await fetch(`${base}/api/reports/history/export?projectId=${projectId}&vehicleNumber=TS01`, { headers: { Authorization: `Bearer ${viewer.accessToken}` } });
    const csvText = await csv.text();
    check("CSV accepts bearer auth and exports only matching rows", csv.status === 200 && csvText.includes(first.sessionCode) && !csvText.includes(second.sessionCode));
    const attendance = (await api(admin, "GET", `/gate-duty/users/${entryUser.id}/attendance?projectId=${projectId}&month=${today.slice(0, 7)}`)).body;
    check("attendance counts successful entries once", attendance.days.find((day) => day.date === today)?.duty.entryCount === 2);
    await api(admin, "GET", `/gate-duty/users/${entryUser.id}/attendance?projectId=${projectId}&month=2026-99`, undefined, 400);
    check("business day changes at midnight in India", businessDateKey(new Date("2026-10-15T19:00:00Z")) === "2026-10-16");
    check("selected date includes the full India business day", parseDateBoundary("2026-10-16", true).toISOString() === "2026-10-16T18:29:59.999Z");

    await Occupancy.updateOne({ allocationId: allocation._id }, { $set: { occupied: 1 } });
    const reconciliation = (await api(admin, "POST", "/settings/reconcile-occupancy", { projectId })).body;
    check("reconciliation repairs drift", reconciliation.corrected === 1);
    await api(admin, "GET", `/audit-logs?projectId=${projectId}`);
    await api(admin, "PATCH", `/users/${viewerUser.id}`, { status: "INACTIVE" });
    check("deactivation disconnects active realtime sessions", (await socketServer.fetchSockets()).length === 0);
    await api(viewer, "GET", "/auth/me", undefined, 401);
    await api(admin, "PATCH", `/users/${viewerUser.id}`, { status: "ACTIVE" });
    await api(viewer, "GET", "/auth/me", undefined, 401);
    check("reactivation does not revive old credentials", true);
    // Lockout must still return authentication errors when email delivery is unconfigured.
    for (let attempt = 0; attempt < 5; attempt++) await recordFailedLogin("lockout@example.com");
    check("failed-login lockout works without an email provider", isAccountLocked("lockout@example.com"));
    clearFailedLogin("lockout@example.com");

    await api(admin, "DELETE", `/projects/${projectId}`);
    check("project deletion removes gate attendance and related records", await GateDuty.countDocuments({ projectId }) === 0 && await ParkingSession.countDocuments({ projectId }) === 0 && await User.countDocuments({ projectId }) === 0 && await Floor.countDocuments({ projectId }) === 0 && await Company.countDocuments({ projectId }) === 0 && await Gate.countDocuments({ projectId }) === 0);
    check("other project remains intact", await Project.countDocuments({ _id: otherProject._id }) === 1);
    console.log(`\n${checks} handoff checks passed.`);
  } finally {
    if (socketServer) await new Promise<void>((resolve) => socketServer!.close(() => resolve()));
    else if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await mongoose.disconnect();
    await database.stop();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
