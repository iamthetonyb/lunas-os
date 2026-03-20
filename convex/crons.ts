/**
 * Scheduled agent jobs — from AGENTS.md:
 *
 * | Schedule        | Agent     | Task                                     |
 * |-----------------|-----------|------------------------------------------|
 * | Weekly Sunday   | Insight   | Run full pattern analysis + RAG ingest   |
 *
 * Daily scheduler/dispatch agents will be added once the system has
 * enough operational data to make confident auto-assignments.
 */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Weekly insight pipeline — every Sunday at 2 AM UTC
crons.weekly(
    "weekly-insight-pipeline",
    { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 0 },
    internal.insights.runWeeklyInsights
);

export default crons;
