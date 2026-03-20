/**
 * AI tool definitions for LUNAS AI assistant.
 * Each tool maps to a Convex query or mutation via the HTTP client.
 */
import { tool } from "ai";
import { z } from "zod";
import { getConvexClient } from "@/lib/convex/http-client";
import { api } from "@/convex/_generated/api";
import {
    readRepoFile,
    listRepoDir,
    writeRepoFile,
    editRepoFile,
} from "@/lib/github/client";

interface ToolOptions {
    userRole?: string;
}

export function createTools(options: ToolOptions = {}) {
    const client = getConvexClient();

    // Auto-log write operations to the decision audit trail
    async function logAction(action: string, input: Record<string, any>, output: any) {
        try {
            await client.mutation(api.ai.logDecision, {
                action,
                input: JSON.stringify(input),
                output: JSON.stringify(output),
                confidence: 0.85,
                source: "chat" as const,
            });
        } catch {
            // Don't let logging failures break tool execution
        }
    }

    return {
        // ── Read Operations ──────────────────────────────────────────

        getSchedule: tool({
            description:
                "Get the work schedule for a date range. Returns jobs with foreman, crew, community, service, and status details.",
            inputSchema: z.object({
                startDate: z
                    .string()
                    .describe("Start date in YYYY-MM-DD format"),
                endDate: z
                    .string()
                    .describe("End date in YYYY-MM-DD format"),
            }),
            execute: async ({ startDate, endDate }) => {
                const jobs = await client.query(
                    api.queries.getScheduleJobs,
                    { startDate, endDate }
                );
                return {
                    count: jobs.length,
                    jobs: jobs.map((j: any) => ({
                        id: j.id,
                        date: j.startDate,
                        builder: j.builderName,
                        community: j.communityName,
                        lot: j.lot,
                        service: j.serviceName,
                        foreman: j.assignedForemanName || "Unassigned",
                        crew: j.assignedCrewName || "Unassigned",
                        status: j.status,
                        isExtraWork: j.isExtraWork,
                    })),
                };
            },
        }),

        getJobRequests: tool({
            description:
                "Get job requests/intakes. Optionally filter to only extra work items.",
            inputSchema: z.object({
                isExtraWork: z
                    .boolean()
                    .optional()
                    .describe("Set true to filter only extra work"),
                limit: z
                    .number()
                    .optional()
                    .describe("Max results to return"),
            }),
            execute: async ({ isExtraWork, limit }) => {
                const jobs = await client.query(api.jobRequests.list, {
                    isExtraWork,
                    limit,
                });
                return {
                    count: (jobs as any[]).length,
                    jobs: (jobs as any[]).map((j: any) => ({
                        id: j.id,
                        builder: j.builderName,
                        community: j.communityName,
                        lot: j.lot,
                        dueDate: j.dueDate,
                        status: j.status || "PENDING",
                        isExtraWork: j.isExtraWork,
                        services: j.services?.map(
                            (s: any) => s.serviceName || s.name
                        ),
                        notes: j.notes,
                        requestedBy: j.requestedBy,
                    })),
                };
            },
        }),

        getBuilders: tool({
            description:
                "List all active builders (construction companies that contract Lunas)",
            inputSchema: z.object({}),
            execute: async () => {
                const builders = await client.query(
                    api.queries.getBuilders,
                    {}
                );
                return (builders as any[]).map((b: any) => ({
                    id: b._id,
                    name: b.name,
                }));
            },
        }),

        getCommunities: tool({
            description:
                "List all active communities (neighborhoods/subdivisions)",
            inputSchema: z.object({}),
            execute: async () => {
                const communities = await client.query(
                    api.queries.getCommunities,
                    {}
                );
                return (communities as any[]).map((c: any) => ({
                    id: c._id,
                    name: c.name,
                    builderId: c.builderId,
                }));
            },
        }),

        getServices: tool({
            description: "List all active services offered by Lunas",
            inputSchema: z.object({}),
            execute: async () => {
                const services = await client.query(
                    api.queries.getServices,
                    {}
                );
                return (services as any[]).map((s: any) => ({
                    id: s._id,
                    name: s.name,
                    code: s.code,
                    category: s.category,
                }));
            },
        }),

        getCrews: tool({
            description:
                "List all crews with their skills and capacity",
            inputSchema: z.object({}),
            execute: async () => {
                const crews = await client.query(
                    api.queries.getCrews,
                    {}
                );
                return (crews as any[]).map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    foremanName: c.foremanName,
                    skills: c.skills,
                    capacityPerDay: c.capacityPerDay,
                }));
            },
        }),

        getDispatchBatches: tool({
            description:
                "List all dispatch batches with their status and job counts",
            inputSchema: z.object({}),
            execute: async () => {
                const batches = await client.query(
                    api.queries.getDispatchBatches,
                    {}
                );
                return batches;
            },
        }),

        getUsers: tool({
            description: "List all users in the system with their roles",
            inputSchema: z.object({}),
            execute: async () => {
                const users = await client.query(
                    api.queries.getUsers,
                    {}
                );
                return (users as any[]).map((u: any) => ({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.systemRole,
                }));
            },
        }),

        // ── Write Operations ─────────────────────────────────────────

        assignForeman: tool({
            description:
                "Assign a foreman to a job. Available foremen: Anahi, Blanca, Chayo, Francisco, Raudel.",
            inputSchema: z.object({
                jobId: z.string().describe("The job service ID"),
                foremanName: z
                    .string()
                    .describe("Foreman name to assign"),
            }),
            execute: async ({ jobId, foremanName }) => {
                const result = await client.mutation(
                    api.mutations.assignForeman,
                    { jobId: jobId as any, foremanName }
                );
                await logAction("assign_foreman", { jobId, foremanName }, result);
                return result;
            },
        }),

        assignCrew: tool({
            description: "Assign a crew to a job",
            inputSchema: z.object({
                jobId: z.string().describe("The job service ID"),
                crewName: z
                    .string()
                    .describe("Crew name to assign"),
            }),
            execute: async ({ jobId, crewName }) => {
                const result = await client.mutation(
                    api.mutations.assignCrew,
                    { jobId: jobId as any, crewName }
                );
                await logAction("assign_crew", { jobId, crewName }, result);
                return result;
            },
        }),

        rescheduleJob: tool({
            description: "Reschedule a job to a new date",
            inputSchema: z.object({
                jobId: z.string().describe("The job service ID"),
                newDate: z
                    .string()
                    .describe("New date in YYYY-MM-DD format"),
                reason: z
                    .string()
                    .optional()
                    .describe("Reason for rescheduling"),
            }),
            execute: async ({ jobId, newDate, reason }) => {
                const result = await client.mutation(
                    api.mutations.rescheduleJob,
                    { jobId: jobId as any, newDate, reason }
                );
                await logAction("reschedule", { jobId, newDate, reason }, result);
                return result;
            },
        }),

        dispatchJob: tool({
            description:
                "Dispatch a job — assigns foreman and crew, creates a dispatch batch",
            inputSchema: z.object({
                jobId: z.string().describe("The job service ID"),
                foremanName: z.string().describe("Foreman name"),
                crewName: z.string().describe("Crew name"),
                serviceDate: z
                    .string()
                    .describe("Service date YYYY-MM-DD"),
            }),
            execute: async ({
                jobId,
                foremanName,
                crewName,
                serviceDate,
            }) => {
                const result = await client.mutation(
                    api.mutations.dispatchJob,
                    { jobId: jobId as any, foremanName, crewName, serviceDate }
                );
                await logAction("dispatch", { jobId, foremanName, crewName, serviceDate }, result);
                return result;
            },
        }),

        createIntake: tool({
            description:
                "Create a new job request/intake. Requires at least a service name. Builder, community, lot, and date are recommended.",
            inputSchema: z.object({
                builderId: z
                    .string()
                    .optional()
                    .describe("Builder document ID"),
                communityId: z
                    .string()
                    .optional()
                    .describe("Community document ID"),
                lot: z.string().optional().describe("Lot number"),
                address: z.string().optional(),
                dueDate: z
                    .string()
                    .optional()
                    .describe("Due date YYYY-MM-DD"),
                notes: z.string().optional(),
                requestedBy: z
                    .string()
                    .optional()
                    .describe("Name of the person requesting"),
                isExtraWork: z.boolean().optional(),
                services: z
                    .array(
                        z.object({
                            serviceName: z
                                .string()
                                .describe("Service name"),
                        })
                    )
                    .describe("List of services needed"),
            }),
            execute: async (args) => {
                const result = await client.mutation(
                    api.mutations.createJobRequest,
                    {
                        builderId: (args.builderId as any) || undefined,
                        communityId:
                            (args.communityId as any) || undefined,
                        lot: args.lot,
                        address: args.address,
                        dueDate: args.dueDate,
                        notes: args.notes,
                        requestedBy: args.requestedBy,
                        isExtraWork: args.isExtraWork,
                        services: args.services,
                    }
                );
                await logAction("create_intake", args, result);
                return result;
            },
        }),

        updateJobRequest: tool({
            description:
                "Update fields on an existing job request (status, amount, notes, etc.)",
            inputSchema: z.object({
                id: z
                    .string()
                    .describe("Job request document ID"),
                status: z.string().optional(),
                amount: z.string().optional(),
                notes: z.string().optional(),
                dueDate: z.string().optional(),
                lot: z.string().optional(),
                address: z.string().optional(),
                poNumber: z.string().optional(),
            }),
            execute: async ({ id, ...updates }) => {
                const filtered: Record<string, any> = { id: id as any };
                for (const [k, v] of Object.entries(updates)) {
                    if (v !== undefined) filtered[k] = v;
                }
                const result = await client.mutation(
                    api.jobRequests.update,
                    filtered as any
                );
                await logAction("update_job_request", { id, ...updates }, result);
                return result;
            },
        }),

        // ── Scheduler Agent ──────────────────────────────────────────────

        runScheduler: tool({
            description:
                "Manually trigger the scheduler agent to auto-assign foremen to unassigned jobs. Shows what assignments were made and their confidence scores. Use when asked to 'run the scheduler', 'auto-assign jobs', or 'balance the workload'.",
            inputSchema: z.object({}),
            execute: async () => {
                const result = await client.action(
                    (api as any).scheduler.autoAssignJobs,
                    {}
                );
                return result;
            },
        }),

        // ── Knowledge & Learning ────────────────────────────────────────

        searchKnowledge: tool({
            description:
                "Search the operational knowledge base (RAG) for patterns, procedures, community-foreman affinities, pricing benchmarks, and historical insights. Use this before making suggestions based on past patterns.",
            inputSchema: z.object({
                query: z
                    .string()
                    .describe(
                        "Natural language query to search for relevant knowledge"
                    ),
                namespace: z
                    .string()
                    .optional()
                    .describe(
                        "Knowledge namespace: operations (default), pricing, scheduling, communities"
                    ),
            }),
            execute: async ({ query, namespace }) => {
                const result = await client.action(api.ai.searchKnowledge, {
                    query,
                    namespace,
                    limit: 5,
                });
                return result;
            },
        }),

        logDecision: tool({
            description:
                "Log an autonomous decision to the audit trail. Use this AFTER making any write operation (assign, dispatch, reschedule, create intake) so every action is tracked.",
            inputSchema: z.object({
                action: z
                    .string()
                    .describe(
                        "Action taken, e.g. auto_assign_foreman, create_intake, reschedule"
                    ),
                input: z
                    .string()
                    .describe("JSON string of what triggered the decision"),
                output: z
                    .string()
                    .describe("JSON string of what was done"),
                confidence: z
                    .number()
                    .optional()
                    .describe("Confidence score 0-1"),
            }),
            execute: async ({ action, input, output, confidence }) => {
                return await client.mutation(api.ai.logDecision, {
                    action,
                    input,
                    output,
                    confidence,
                    source: "chat",
                });
            },
        }),

        getRecentDecisions: tool({
            description:
                "View recent AI decision logs — useful for reviewing what autonomous actions have been taken",
            inputSchema: z.object({
                limit: z
                    .number()
                    .optional()
                    .describe("Number of decisions to return (default 10)"),
            }),
            execute: async ({ limit }) => {
                return await client.query(api.ai.getRecentDecisions, {
                    limit: limit ?? 10,
                });
            },
        }),

        analyzePerformance: tool({
            description:
                "Analyze AI performance — shows approval rates, confidence calibration, and evolution insights. Use when an admin asks 'how well is the AI doing?' or 'are the auto-assignments working?'",
            inputSchema: z.object({}),
            execute: async () => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return await client.action(
                    (api as any).insights.analyzeEvolution,
                    {}
                );
            },
        }),

        // ── Agentic Code Editing (ADMIN only) ────────────────────────────

        readFile: tool({
            description:
                "Read a file from the LUNAS-OS GitHub repo. Use this to inspect code before making edits. ADMIN ONLY.",
            inputSchema: z.object({
                path: z
                    .string()
                    .describe(
                        "File path relative to repo root, e.g. 'app/dashboard/page.tsx'"
                    ),
            }),
            execute: async ({ path }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can read repo files." };
                }
                try {
                    const file = await readRepoFile(path);
                    return {
                        path: file.path,
                        content: file.content,
                        lines: file.content.split("\n").length,
                    };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
        }),

        listFiles: tool({
            description:
                "List files in a directory of the LUNAS-OS GitHub repo. ADMIN ONLY.",
            inputSchema: z.object({
                path: z
                    .string()
                    .describe(
                        "Directory path relative to repo root, e.g. 'app' or 'components'"
                    ),
            }),
            execute: async ({ path }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can browse repo files." };
                }
                try {
                    const items = await listRepoDir(path);
                    return { path, items };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
        }),

        editFile: tool({
            description:
                "Edit a file in the LUNAS-OS repo by replacing specific text. Commits directly to main branch. Always read the file first to get exact text. ADMIN ONLY.",
            inputSchema: z.object({
                path: z
                    .string()
                    .describe("File path relative to repo root"),
                oldText: z
                    .string()
                    .describe(
                        "Exact text to find and replace (must match file contents)"
                    ),
                newText: z
                    .string()
                    .describe("Replacement text"),
                commitMessage: z
                    .string()
                    .describe(
                        "Short commit message describing the change"
                    ),
            }),
            execute: async ({ path, oldText, newText, commitMessage }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can edit repo files." };
                }
                try {
                    const result = await editRepoFile(
                        path,
                        oldText,
                        newText,
                        `[LUNAS AI] ${commitMessage}`
                    );
                    await logAction("code_edit", { path, commitMessage }, result);
                    return {
                        success: true,
                        path: result.path,
                        commitSha: result.commitSha,
                        commitUrl: result.commitUrl,
                    };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
        }),

        createFile: tool({
            description:
                "Create a new file in the LUNAS-OS repo. Commits directly to main branch. ADMIN ONLY.",
            inputSchema: z.object({
                path: z
                    .string()
                    .describe("File path relative to repo root"),
                content: z.string().describe("Full file content"),
                commitMessage: z
                    .string()
                    .describe(
                        "Short commit message describing what was created"
                    ),
            }),
            execute: async ({ path, content, commitMessage }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can create repo files." };
                }
                try {
                    const result = await writeRepoFile(
                        path,
                        content,
                        `[LUNAS AI] ${commitMessage}`
                    );
                    await logAction("code_create", { path, commitMessage }, result);
                    return {
                        success: true,
                        path: result.path,
                        commitSha: result.commitSha,
                        commitUrl: result.commitUrl,
                    };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
        }),

        overwriteFile: tool({
            description:
                "Overwrite an entire file in the LUNAS-OS repo with new content. Use when the changes are too extensive for editFile. Commits directly to main. ADMIN ONLY.",
            inputSchema: z.object({
                path: z
                    .string()
                    .describe("File path relative to repo root"),
                content: z.string().describe("Complete new file content"),
                commitMessage: z
                    .string()
                    .describe("Short commit message"),
            }),
            execute: async ({ path, content, commitMessage }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can overwrite repo files." };
                }
                try {
                    const result = await writeRepoFile(
                        path,
                        content,
                        `[LUNAS AI] ${commitMessage}`
                    );
                    await logAction("code_overwrite", { path, commitMessage }, result);
                    return {
                        success: true,
                        path: result.path,
                        commitSha: result.commitSha,
                        commitUrl: result.commitUrl,
                    };
                } catch (e: any) {
                    return { error: e.message };
                }
            },
        }),
    };
}
