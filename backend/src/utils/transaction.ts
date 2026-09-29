import mongoose, { ClientSession } from "mongoose";

/**
 * Runs `fn` inside a MongoDB transaction. `session.withTransaction` already
 * retries on TransientTransactionError / UnknownTransactionCommitResult per
 * the MongoDB driver's documented retry loop, which is what protects the
 * concurrent-entry / concurrent-exit guarantees under real network noise.
 */
export async function runInTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  let result: T;
  try {
    await session.withTransaction(async () => {
      result = await fn(session);
    });
  } finally {
    await session.endSession();
  }
  return result!;
}
