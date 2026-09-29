import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { Project } from "../models";
import { reconcileOccupancy } from "../services/reconciliationService";

async function main() {
  await connectDB();
  const projectCode = process.argv[2];

  const projects = projectCode
    ? await Project.find({ code: projectCode.toUpperCase() }).lean()
    : await Project.find().lean();

  if (projects.length === 0) {
    console.log("[reconcile] No matching projects found.");
    await mongoose.disconnect();
    return;
  }

  for (const project of projects) {
    console.log(`[reconcile] Checking project ${project.name} (${project.code})...`);
    const results = await reconcileOccupancy(String(project._id), null);
    const corrected = results.filter((r) => r.corrected);
    console.log(
      `[reconcile]   ${results.length} allocations checked, ${corrected.length} corrected.`
    );
    for (const c of corrected) {
      console.log(
        `[reconcile]   allocation ${c.allocationId}: ${c.previousOccupied} -> ${c.actualOccupied}`
      );
    }
  }

  await mongoose.disconnect();
  console.log("[reconcile] Done.");
}

main().catch((err) => {
  console.error("[reconcile] Failed", err);
  process.exit(1);
});
