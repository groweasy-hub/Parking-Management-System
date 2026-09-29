import { Schema, model, Document, ClientSession } from "mongoose";

interface ICounter extends Document<string> {
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = model<ICounter>("Counter", counterSchema);

/**
 * Atomically increments and returns the next sequence number for `key`.
 * Used to generate human-friendly session codes (PS000123) without race
 * conditions, safe to call inside an active transaction session.
 */
export async function nextSequence(key: string, session?: ClientSession): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session }
  );
  return doc!.seq;
}
