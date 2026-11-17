import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "../config/env";

async function migrateOptionalEmailIndex() {
  if (env.dnsServers.length > 0) dns.setServers(env.dnsServers);
  const connection = await mongoose.createConnection(env.mongodbUri, { autoIndex: false }).asPromise();
  try {
    const users = connection.collection("users");
    await users.updateMany({ email: { $in: [null, ""] } }, { $unset: { email: "" } });
    const indexes = await users.indexes();
    const emailIndex = indexes.find((index) => index.key.email === 1);

    if (emailIndex && (emailIndex.unique !== true || emailIndex.sparse !== true)) {
      await users.dropIndex(emailIndex.name!);
    }

    await users.createIndex({ email: 1 }, { name: "email_1", unique: true, sparse: true });
    console.log("[migration] User email index now allows accounts without work email.");
  } finally {
    await connection.close();
  }
}

migrateOptionalEmailIndex().catch((error: unknown) => {
  console.error("[migration] Could not update the optional email index.", error);
  process.exitCode = 1;
});
