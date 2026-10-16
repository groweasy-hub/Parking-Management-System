import assert from "node:assert/strict";
import http from "node:http";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: http.Server) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function main() {
  const database = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  let appServer: http.Server | undefined;
  try {
    process.env.MONGODB_URI = database.getUri();
    process.env.JWT_ACCESS_SECRET = "password-reset-test-access";
    process.env.JWT_REFRESH_SECRET = "password-reset-test-refresh";
    process.env.NODE_ENV = "test";
    process.env.FRONTEND_URL = "http://localhost:3000";
    process.env.PASSWORD_RESET_WEBHOOK_URL = "";

    const { connectDB } = await import("../config/db.js");
    const { createApp } = await import("../app.js");
    const { User } = await import("../models/index.js");
    const { hashPassword, comparePassword } = await import("../utils/password.js");
    const { passwordResetLimiter } = await import("../middleware/rateLimiters.js");
    await connectDB();
    const user = await User.create({
      name: "Reset Test", email: "reset@example.com", role: "SUPER_ADMIN",
      passwordHash: await hashPassword("Original123!"), mustChangePassword: true,
    });
    await User.create({
      name: "Inactive Test", email: "inactive@example.com", role: "SUPER_ADMIN",
      passwordHash: await hashPassword("Original123!"), status: "INACTIVE",
    });
    appServer = http.createServer(createApp());
    const base = await listen(appServer);
    const post = (path: string, body: unknown) => fetch(`${base}/api/auth/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    let latestResetToken = "";
    const checkEmail = async () => {
      const response = await post("forgot-password", { email: " RESET@EXAMPLE.COM " });
      if (response.status === 200) {
        const body = await response.clone().json() as { resetToken: string };
        assert.match(body.resetToken, /^[a-f0-9]{64}$/);
        assert.equal(response.headers.get("cache-control"), "no-store");
        latestResetToken = body.resetToken;
      }
      return response;
    };
    const latestToken = () => latestResetToken;
    const reset = (token: string, newPassword = "Updated123!") => post("reset-password", { token, newPassword });
    const originalLogin = await post("login", { email: user.email, password: "Original123!" });
    const originalAuth = await originalLogin.json() as { accessToken: string };
    const originalRefresh = originalLogin.headers.getSetCookie().find((cookie) => cookie.startsWith("refreshToken="))!.split(";")[0];

    assert.equal((await post("forgot-password", { email: "wrong" })).status, 400);
    assert.equal((await post("forgot-password", { email: "missing@example.com" })).status, 404);
    assert.equal((await post("forgot-password", { email: "inactive@example.com" })).status, 404);
    assert.equal((await checkEmail()).status, 200);
    const firstToken = latestToken();
    const stored = await User.findById(user._id).select("+passwordResetTokenHash +passwordResetExpiresAt");
    assert.equal(stored!.passwordResetTokenHash, createHash("sha256").update(firstToken).digest("hex"));
    assert(stored!.passwordResetExpiresAt!.getTime() > Date.now());
    const publicUser = await User.findById(user._id).lean();
    assert(!("passwordResetTokenHash" in publicUser!));
    assert.equal((await reset(firstToken, "short")).status, 400);
    assert.equal((await checkEmail()).status, 200);
    const secondToken = latestToken();
    assert.notEqual(secondToken, firstToken);
    assert.equal((await reset(firstToken)).status, 400);
    const concurrent = await Promise.all([reset(secondToken), reset(secondToken)]);
    assert.deepEqual(concurrent.map((res) => res.status).sort(), [200, 400]);
    assert.equal((await reset(secondToken)).status, 400);
    assert.equal((await checkEmail()).status, 429);
    console.log("PASS: database email check without email delivery, token hashing, replacement, one-time use, concurrency, rate limiting");

    // Isolate the remaining cases from the preceding rate-limit assertion.
    passwordResetLimiter.resetKey("127.0.0.1");
    assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${originalAuth.accessToken}` } })).status, 401);
    assert.equal((await fetch(`${base}/api/auth/refresh`, { method: "POST", headers: { Cookie: originalRefresh } })).status, 401);
    const changed = await User.findById(user._id).select("+passwordHash +passwordResetTokenHash");
    assert(await comparePassword("Updated123!", changed!.passwordHash));
    assert.equal(changed!.mustChangePassword, false);
    assert.equal(changed!.passwordResetTokenHash, undefined);
    assert.equal((await post("login", { email: user.email, password: "Original123!" })).status, 401);
    assert.equal((await post("login", { email: user.email, password: "Updated123!" })).status, 200);

    assert.equal((await checkEmail()).status, 200);
    const expiredToken = latestToken();
    await User.updateOne({ _id: user._id }, { $set: { passwordResetExpiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await reset(expiredToken)).status, 400);
    assert.equal((await checkEmail()).status, 200);
    const pendingToken = latestToken();
    const currentLogin = await post("login", { email: user.email, password: "Updated123!" });
    const currentAuth = await currentLogin.json() as { accessToken: string };
    const change = await fetch(`${base}/api/auth/change-password`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentAuth.accessToken}` },
      body: JSON.stringify({ oldPassword: "Updated123!", newPassword: "ChangedAgain123!" }),
    });
    assert.equal(change.status, 200);
    assert.equal((await reset(pendingToken)).status, 400);
    console.log("PASS: changing a password invalidates outstanding reset links");
    assert.equal((await checkEmail()).status, 200);
    const disabledToken = latestToken();
    await User.updateOne({ _id: user._id }, { $set: { status: "INACTIVE" } });
    assert.equal((await reset(disabledToken)).status, 400);
    const disabledUser = await User.findById(user._id).select("+passwordHash");
    assert(await comparePassword("ChangedAgain123!", disabledUser!.passwordHash));
    assert.equal((await reset("0".repeat(64))).status, 400);
    console.log("PASS: new-password login, old-password rejection, expiry, inactive account protection, invalid token rejection");

  } finally {
    if (appServer) await close(appServer);
    await mongoose.disconnect();
    await database.stop();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
