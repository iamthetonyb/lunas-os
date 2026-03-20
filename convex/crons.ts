/**
 * Scheduled agent jobs — from AGENTS.md:
 *
 * | Schedule        | Agent     | Task                                     |
 * |-----------------|-----------|------------------------------------------|
 * | Daily 5:00 AM   | Scheduler | Auto-assign unassigned jobs for today     |
 * | Weekly Sunday   | Insight   | Run full pattern analysis + RAG ingest    |
 */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily scheduler — auto-assign foremen to unassigned jobs
// Runs at 5 AM CST = 11:00 UTC
crons.daily(
    "daily-scheduler",
    { hourUTC: 11, minuteUTC: 0 },
    internal.scheduler.autoAssignJobs
);

// Weekly insight pipeline — every Sunday at 2 AM UTC
crons.weekly(
    "weekly-insight-pipeline",
    { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 0 },
    internal.insights.runWeeklyInsights
);

export default crons;
