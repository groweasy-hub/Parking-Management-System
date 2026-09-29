import mongoose from "mongoose";
import { env } from "./env";

mongoose.set("strictQuery", true);

let connectionPromise: Promise<typeof mongoose> | null = null;

async function createLocalDevReplicaSet(): Promise<string> {
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  const uri = replSet.getUri("parking_system");
  process.env.MONGODB_URI = uri;
  return uri;
}

export function connectDB(): Promise<typeof mongoose> {
  if (connectionPromise) return connectionPromise;

  mongoose.connection.on("connected", () => {
    console.log("[mongo] connected");
  });
  mongoose.connection.on("error", (err) => {
    console.error("[mongo] connection error", err);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[mongo] disconnected");
  });

  connectionPromise = (async () => {
    const baseUri = process.env.MONGODB_URI ?? env.mongodbUri;

    const opts = baseUri.includes("mongodb+srv") || baseUri.includes("mongodb.net")
      ? { tls: true, tlsAllowInvalidCertificates: false, serverSelectionTimeoutMS: 8000 }
      : {};

    try {
      return await mongoose.connect(baseUri, opts);
    } catch (err) {
      if (process.env.NODE_ENV === "production") {
        throw err;
      }

      console.warn(
        "[mongo] Could not reach configured MongoDB; starting local in-memory replica set for development.",
      );

      const fallbackUri = await createLocalDevReplicaSet();
      return await mongoose.connect(fallbackUri);
    }
  })();

  return connectionPromise;
}

/**
 * Transactions and change streams both require the underlying MongoDB
 * deployment to be a replica set (Atlas clusters are replica sets by
 * default). This is checked at startup so misconfiguration fails fast
 * instead of silently degrading concurrency safety.
 */
export async function assertReplicaSet(): Promise<void> {
  const admin = mongoose.connection.db?.admin();
  if (!admin) return;
  try {
    const info = await admin.command({ isMaster: 1 });
    if (!info.setName) {
      console.warn(
        "[mongo] WARNING: MongoDB is not running as a replica set. " +
          "Transactions and real-time change streams require a replica set " +
          "(use MongoDB Atlas, or `rs.initiate()` on a local single-node set).",
      );
    }
  } catch (err) {
    console.warn("[mongo] Could not verify replica set status", err);
  }
}
