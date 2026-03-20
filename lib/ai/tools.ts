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
import { sendEmail, sendSms } from "@/lib/notifications";

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

        // ── Dispatch Agent ───────────────────────────────────────────────

        runDispatch: tool({
            description:
                "Manually trigger the dispatch agent to auto-batch today's assigned jobs into dispatch batches. Groups by crew+date, flags anomalies like double-booked lots. Use when asked to 'run dispatch', 'send out today\\'s jobs', or 'batch the dispatches'.",
            inputSchema: z.object({}),
            execute: async () => {
                const result = await client.action(
                    (api as any).dispatchAgent.autoDispatch,
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

        // ── User & Crew Management (ADMIN) ─────────────────────────────

        createUser: tool({
            description:
                "Create a new user in the system. Requires email and role (ADMIN, FOREMAN, CREW, CUSTOMER). ADMIN ONLY.",
            inputSchema: z.object({
                email: z.string().describe("User's email address"),
                name: z.string().optional().describe("Full name"),
                phone: z.string().optional().describe("Phone number"),
                role: z
                    .enum(["ADMIN", "FOREMAN", "CREW", "CUSTOMER"])
                    .describe("User role"),
            }),
            execute: async ({ email, name, phone, role }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can create users." };
                }
                const result = await client.mutation(
                    api.mutations.createUser,
                    { email, name, phone, role }
                );
                await logAction("create_user", { email, name, role }, result);
                return result;
            },
        }),

        updateUser: tool({
            description:
                "Update an existing user's name or phone. ADMIN ONLY.",
            inputSchema: z.object({
                userId: z.string().describe("User document ID"),
                name: z.string().optional().describe("Updated name"),
                phone: z.string().optional().describe("Updated phone"),
            }),
            execute: async ({ userId, name, phone }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can update users." };
                }
                const result = await client.mutation(
                    api.mutations.updateUser,
                    { userId: userId as any, name, phone }
                );
                await logAction("update_user", { userId, name, phone }, result);
                return result;
            },
        }),

        deleteUser: tool({
            description:
                "Delete a user and their org memberships. This is permanent. ADMIN ONLY.",
            inputSchema: z.object({
                userId: z.string().describe("User document ID"),
            }),
            execute: async ({ userId }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can delete users." };
                }
                const result = await client.mutation(
                    api.mutations.deleteUser,
                    { userId: userId as any }
                );
                await logAction("delete_user", { userId }, result);
                return result;
            },
        }),

        createCrew: tool({
            description:
                "Create a new crew. Specify name, optionally link a foreman, set skills and daily capacity. ADMIN ONLY.",
            inputSchema: z.object({
                name: z
                    .string()
                    .describe("Crew name (e.g. 'Carmen', 'Luis D')"),
                foremanId: z
                    .string()
                    .optional()
                    .describe("Foreman user ID to link"),
                skills: z
                    .array(z.string())
                    .optional()
                    .describe(
                        "Skill list e.g. ['rough clean', 'final clean']"
                    ),
                capacityPerDay: z
                    .number()
                    .optional()
                    .describe("Max jobs per day"),
            }),
            execute: async ({ name, foremanId, skills, capacityPerDay }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can create crews." };
                }
                const result = await client.mutation(
                    api.mutations.createCrew,
                    {
                        name,
                        foremanId: foremanId
                            ? (foremanId as any)
                            : undefined,
                        skills,
                        capacityPerDay,
                    }
                );
                await logAction(
                    "create_crew",
                    { name, foremanId, skills, capacityPerDay },
                    result
                );
                return result;
            },
        }),

        // ── Master Data Management (ADMIN) ─────────────────────────────

        createBuilder: tool({
            description:
                "Add a new builder (construction company). ADMIN ONLY.",
            inputSchema: z.object({
                name: z.string().describe("Builder company name"),
            }),
            execute: async ({ name }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can create builders." };
                }
                const result = await client.mutation(
                    api.mutations.createBuilder,
                    { name }
                );
                await logAction("create_builder", { name }, result);
                return result;
            },
        }),

        updateBuilder: tool({
            description: "Update a builder's name. ADMIN ONLY.",
            inputSchema: z.object({
                id: z.string().describe("Builder document ID"),
                name: z.string().optional().describe("Updated name"),
            }),
            execute: async ({ id, name }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can update builders." };
                }
                const result = await client.mutation(
                    api.mutations.updateBuilder,
                    { id: id as any, name }
                );
                await logAction("update_builder", { id, name }, result);
                return result;
            },
        }),

        createCommunity: tool({
            description:
                "Add a new community (neighborhood/subdivision), optionally linked to a builder. ADMIN ONLY.",
            inputSchema: z.object({
                name: z.string().describe("Community name"),
                builderId: z
                    .string()
                    .optional()
                    .describe("Builder ID to link"),
            }),
            execute: async ({ name, builderId }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can create communities." };
                }
                const result = await client.mutation(
                    api.mutations.createCommunity,
                    {
                        name,
                        builderId: builderId
                            ? (builderId as any)
                            : undefined,
                    }
                );
                await logAction(
                    "create_community",
                    { name, builderId },
                    result
                );
                return result;
            },
        }),

        updateCommunity: tool({
            description:
                "Update a community's name or builder link. ADMIN ONLY.",
            inputSchema: z.object({
                id: z.string().describe("Community document ID"),
                name: z.string().optional().describe("Updated name"),
                builderId: z
                    .string()
                    .optional()
                    .describe("Updated builder ID"),
            }),
            execute: async ({ id, name, builderId }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can update communities." };
                }
                const result = await client.mutation(
                    api.mutations.updateCommunity,
                    {
                        id: id as any,
                        name,
                        builderId: builderId
                            ? (builderId as any)
                            : undefined,
                    }
                );
                await logAction(
                    "update_community",
                    { id, name, builderId },
                    result
                );
                return result;
            },
        }),

        createService: tool({
            description: "Add a new service type. ADMIN ONLY.",
            inputSchema: z.object({
                name: z
                    .string()
                    .describe(
                        "Service name (e.g. 'Clean Final', 'Power Wash')"
                    ),
                description: z.string().optional(),
                code: z.string().optional().describe("Service code"),
                category: z
                    .string()
                    .optional()
                    .describe("Category grouping"),
                unitKind: z
                    .enum(["PER_JOB", "PER_SQFT", "PER_UNIT"])
                    .optional()
                    .describe("Pricing unit basis"),
            }),
            execute: async ({ name, description, code, category, unitKind }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can create services." };
                }
                const result = await client.mutation(
                    api.mutations.createService,
                    { name, description, code, category, unitKind }
                );
                await logAction(
                    "create_service",
                    { name, code, category, unitKind },
                    result
                );
                return result;
            },
        }),

        updateService: tool({
            description:
                "Update a service type's properties. ADMIN ONLY.",
            inputSchema: z.object({
                id: z.string().describe("Service document ID"),
                name: z.string().optional(),
                description: z.string().optional(),
                code: z.string().optional(),
                category: z.string().optional(),
                unitKind: z.string().optional(),
            }),
            execute: async ({ id, ...updates }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can update services." };
                }
                const filtered: Record<string, any> = { id: id as any };
                for (const [k, v] of Object.entries(updates)) {
                    if (v !== undefined) filtered[k] = v;
                }
                const result = await client.mutation(
                    api.mutations.updateService,
                    filtered as any
                );
                await logAction(
                    "update_service",
                    { id, ...updates },
                    result
                );
                return result;
            },
        }),

        // ── Model Plans ────────────────────────────────────────────────

        getModelPlans: tool({
            description:
                "List all active model plans (builder home models with sqft and defaults)",
            inputSchema: z.object({}),
            execute: async () => {
                const plans = await client.query(
                    api.queries.getModelPlans,
                    {}
                );
                return (plans as any[]).map((p: any) => ({
                    id: p._id,
                    name: p.name,
                    code: p.code,
                    sqft: p.sqft,
                    builderId: p.builderId,
                    communityId: p.communityId,
                }));
            },
        }),

        createModelPlan: tool({
            description:
                "Create a new model plan (home model with sqft). ADMIN ONLY.",
            inputSchema: z.object({
                name: z.string().describe("Model name"),
                builderId: z.string().optional().describe("Builder ID"),
                communityId: z
                    .string()
                    .optional()
                    .describe("Community ID"),
                code: z.string().optional().describe("Model code"),
                sqft: z.string().optional().describe("Square footage"),
            }),
            execute: async ({ name, builderId, communityId, code, sqft }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can create model plans." };
                }
                const result = await client.mutation(
                    api.mutations.createModelPlan,
                    {
                        name,
                        builderId: builderId
                            ? (builderId as any)
                            : undefined,
                        communityId: communityId
                            ? (communityId as any)
                            : undefined,
                        code,
                        sqft,
                    }
                );
                await logAction(
                    "create_model_plan",
                    { name, code, sqft },
                    result
                );
                return result;
            },
        }),

        updateModelPlan: tool({
            description:
                "Update a model plan's properties. ADMIN ONLY.",
            inputSchema: z.object({
                id: z.string().describe("Model plan document ID"),
                name: z.string().optional(),
                code: z.string().optional(),
                sqft: z.string().optional(),
                builderId: z.string().optional(),
            }),
            execute: async ({ id, name, code, sqft, builderId }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can update model plans." };
                }
                const result = await client.mutation(
                    api.mutations.updateModelPlan,
                    {
                        id: id as any,
                        name,
                        code,
                        sqft,
                        builderId: builderId
                            ? (builderId as any)
                            : undefined,
                    }
                );
                await logAction(
                    "update_model_plan",
                    { id, name, code, sqft },
                    result
                );
                return result;
            },
        }),

        // ── Invoicing & Blue Book ──────────────────────────────────────

        buildInvoice: tool({
            description:
                "Create an invoice from blue book entries. Calculates totals and creates line items. Use getBlueBookEntries first to find uninvoiced entries. ADMIN ONLY.",
            inputSchema: z.object({
                builderId: z.string().describe("Builder to invoice"),
                entryIds: z
                    .array(z.string())
                    .describe(
                        "Array of blue book entry IDs to include"
                    ),
            }),
            execute: async ({ builderId, entryIds }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can build invoices." };
                }
                const result = await client.mutation(api.invoicing.build, {
                    builderId: builderId as any,
                    entryIds: entryIds.map((id: string) => id as any),
                });
                await logAction(
                    "build_invoice",
                    { builderId, entryCount: entryIds.length },
                    result
                );
                return result;
            },
        }),

        getInvoice: tool({
            description:
                "Get invoice details including line items and builder name",
            inputSchema: z.object({
                id: z.string().describe("Invoice document ID"),
            }),
            execute: async ({ id }) => {
                return await client.query(api.invoicing.getById, {
                    id: id as any,
                });
            },
        }),

        getBlueBookEntries: tool({
            description:
                "List blue book entries (builder payment data). Filter by builder, status, or invoiced state. Use invoiced=false to find entries ready for invoicing.",
            inputSchema: z.object({
                builderId: z
                    .string()
                    .optional()
                    .describe("Filter by builder ID"),
                status: z
                    .string()
                    .optional()
                    .describe("Filter by status"),
                invoiced: z
                    .boolean()
                    .optional()
                    .describe("Filter: false = uninvoiced only"),
                search: z
                    .string()
                    .optional()
                    .describe("Search lot, PO, check number, etc."),
            }),
            execute: async ({ builderId, status, invoiced, search }) => {
                const result = await client.query(api.blueBook.list, {
                    builderId: builderId
                        ? (builderId as any)
                        : undefined,
                    status,
                    invoiced,
                    search,
                    pageSize: 50,
                });
                return {
                    count: (result as any).total,
                    entries: (result as any).entries?.map((e: any) => ({
                        id: e.id,
                        lot: e.lot,
                        communityName: e.communityName,
                        builderName: e.builderName,
                        amount: e.amount,
                        status: e.status,
                        checkNumber: e.checkNumber,
                        checkDate: e.checkDate,
                        accountCategory: e.accountCategoryName,
                        invoiced: !!e.invoiceLineId,
                    })),
                };
            },
        }),

        updateBlueBookEntry: tool({
            description:
                "Update a blue book entry (status, amount, assignment, etc.). ADMIN ONLY.",
            inputSchema: z.object({
                id: z.string().describe("Blue book entry ID"),
                status: z.string().optional(),
                amount: z.string().optional(),
                assignedForemanName: z.string().optional(),
                crewName: z.string().optional(),
                lot: z.string().optional(),
                checkNumber: z.string().optional(),
                checkDate: z.string().optional(),
            }),
            execute: async ({ id, ...updates }) => {
                if (options.userRole !== "ADMIN") {
                    return {
                        error: "Only admins can update blue book entries.",
                    };
                }
                const filtered: Record<string, any> = { id: id as any };
                for (const [k, v] of Object.entries(updates)) {
                    if (v !== undefined) filtered[k] = v;
                }
                const result = await client.mutation(
                    api.blueBook.update,
                    filtered as any
                );
                await logAction(
                    "update_bluebook",
                    { id, ...updates },
                    result
                );
                return result;
            },
        }),

        // ── Contract Rates ─────────────────────────────────────────────

        getContractRates: tool({
            description:
                "List all active contract rates (pricing by builder, service, model)",
            inputSchema: z.object({}),
            execute: async () => {
                const rates = await client.query(
                    api.contractRates.list,
                    {}
                );
                return (rates as any[]).map((r: any) => ({
                    id: r.id,
                    builderId: r.builderId,
                    serviceId: r.serviceId,
                    modelPlanId: r.modelPlanId,
                    basis: r.basis,
                    rate: r.rate,
                    unitLabel: r.unitLabel,
                    effectiveOn: r.effectiveOn,
                    expiresOn: r.expiresOn,
                }));
            },
        }),

        createContractRate: tool({
            description:
                "Create a new contract rate (price for a builder+service combo). ADMIN ONLY.",
            inputSchema: z.object({
                builderId: z
                    .string()
                    .optional()
                    .describe("Builder ID"),
                serviceId: z
                    .string()
                    .optional()
                    .describe("Service ID"),
                modelPlanId: z
                    .string()
                    .optional()
                    .describe("Model plan ID (for sqft-based rates)"),
                basis: z
                    .string()
                    .optional()
                    .describe(
                        "Rate basis: PER_JOB, PER_SQFT, PER_UNIT"
                    ),
                rate: z.string().optional().describe("Rate amount"),
                unitLabel: z
                    .string()
                    .optional()
                    .describe(
                        "Unit label (e.g. 'per lot', 'per sqft')"
                    ),
                effectiveOn: z
                    .string()
                    .optional()
                    .describe("Effective date YYYY-MM-DD"),
                expiresOn: z
                    .string()
                    .optional()
                    .describe("Expiration date YYYY-MM-DD"),
            }),
            execute: async (args) => {
                if (options.userRole !== "ADMIN") {
                    return {
                        error: "Only admins can create contract rates.",
                    };
                }
                const result = await client.mutation(
                    api.contractRates.create,
                    {
                        builderId: args.builderId
                            ? (args.builderId as any)
                            : undefined,
                        serviceId: args.serviceId
                            ? (args.serviceId as any)
                            : undefined,
                        modelPlanId: args.modelPlanId
                            ? (args.modelPlanId as any)
                            : undefined,
                        basis: args.basis,
                        rate: args.rate,
                        unitLabel: args.unitLabel,
                        effectiveOn: args.effectiveOn,
                        expiresOn: args.expiresOn,
                    }
                );
                await logAction("create_contract_rate", args, result);
                return result;
            },
        }),

        updateContractRate: tool({
            description:
                "Update an existing contract rate. ADMIN ONLY.",
            inputSchema: z.object({
                id: z.string().describe("Contract rate document ID"),
                basis: z.string().optional(),
                rate: z.string().optional(),
                unitLabel: z.string().optional(),
                effectiveOn: z.string().optional(),
                expiresOn: z.string().optional(),
            }),
            execute: async ({ id, ...updates }) => {
                if (options.userRole !== "ADMIN") {
                    return {
                        error: "Only admins can update contract rates.",
                    };
                }
                const filtered: Record<string, any> = { id: id as any };
                for (const [k, v] of Object.entries(updates)) {
                    if (v !== undefined) filtered[k] = v;
                }
                const result = await client.mutation(
                    api.contractRates.update,
                    filtered as any
                );
                await logAction(
                    "update_contract_rate",
                    { id, ...updates },
                    result
                );
                return result;
            },
        }),

        // ── Delete & Complete Operations ───────────────────────────────

        deleteJobRequest: tool({
            description:
                "Delete a job request and all its services. This is permanent. ADMIN ONLY.",
            inputSchema: z.object({
                id: z.string().describe("Job request document ID"),
            }),
            execute: async ({ id }) => {
                if (options.userRole !== "ADMIN") {
                    return {
                        error: "Only admins can delete job requests.",
                    };
                }
                const result = await client.mutation(
                    api.jobRequests.remove,
                    { id: id as any }
                );
                await logAction("delete_job_request", { id }, result);
                return result;
            },
        }),

        deleteDispatchBatch: tool({
            description:
                "Delete a dispatch batch and all its assignments. This is permanent. ADMIN ONLY.",
            inputSchema: z.object({
                batchId: z
                    .string()
                    .describe("Dispatch batch document ID"),
            }),
            execute: async ({ batchId }) => {
                if (options.userRole !== "ADMIN") {
                    return {
                        error: "Only admins can delete dispatch batches.",
                    };
                }
                const result = await client.mutation(
                    api.mutations.deleteDispatchBatch,
                    { batchId: batchId as any }
                );
                await logAction(
                    "delete_dispatch_batch",
                    { batchId },
                    result
                );
                return result;
            },
        }),

        completeAssignment: tool({
            description:
                "Mark an assignment as complete. Optionally include window/tub counts and signatures. Also marks the linked job service as COMPLETE.",
            inputSchema: z.object({
                id: z.string().describe("Assignment document ID"),
                windows: z
                    .string()
                    .optional()
                    .describe("Window count"),
                tubs: z.string().optional().describe("Tub count"),
                notes: z
                    .string()
                    .optional()
                    .describe("Completion notes"),
                foremanSig: z
                    .string()
                    .optional()
                    .describe("Foreman signature data"),
                customerSig: z
                    .string()
                    .optional()
                    .describe("Customer signature data"),
            }),
            execute: async ({
                id,
                windows,
                tubs,
                notes,
                foremanSig,
                customerSig,
            }) => {
                const result = await client.mutation(
                    api.assignmentFunctions.complete,
                    {
                        id: id as any,
                        windows,
                        tubs,
                        notes,
                        foremanSig,
                        customerSig,
                    }
                );
                await logAction("complete_assignment", { id }, result);
                return result;
            },
        }),

        // ── Organization ───────────────────────────────────────────────

        getOrgs: tool({
            description: "List all organizations in the system",
            inputSchema: z.object({}),
            execute: async () => {
                const orgs = await client.query(
                    api.queries.getOrgs,
                    {}
                );
                return (orgs as any[]).map((o: any) => ({
                    id: o._id,
                    name: o.name,
                    slug: o.slug,
                }));
            },
        }),

        createOrg: tool({
            description:
                "Create a new organization. ADMIN ONLY.",
            inputSchema: z.object({
                name: z.string().describe("Organization name"),
            }),
            execute: async ({ name }) => {
                if (options.userRole !== "ADMIN") {
                    return {
                        error: "Only admins can create organizations.",
                    };
                }
                const result = await client.mutation(
                    api.mutations.createOrg,
                    { name }
                );
                await logAction("create_org", { name }, result);
                return result;
            },
        }),

        assignOrgMembership: tool({
            description:
                "Assign a user to an organization with a role (admin, backoffice, contractor). ADMIN ONLY.",
            inputSchema: z.object({
                userId: z.string().describe("User document ID"),
                orgId: z
                    .string()
                    .describe("Organization document ID"),
                role: z
                    .enum(["admin", "backoffice", "contractor"])
                    .describe("Org role"),
            }),
            execute: async ({ userId, orgId, role }) => {
                if (options.userRole !== "ADMIN") {
                    return {
                        error: "Only admins can manage org memberships.",
                    };
                }
                const result = await client.mutation(
                    api.mutations.assignOrgMembership,
                    {
                        userId: userId as any,
                        orgId: orgId as any,
                        role,
                    }
                );
                await logAction(
                    "assign_org_membership",
                    { userId, orgId, role },
                    result
                );
                return result;
            },
        }),

        // ── Notifications ──────────────────────────────────────────────

        sendEmailNotification: tool({
            description:
                "Send an email notification. ADMIN ONLY. Use for dispatch alerts, schedule changes, invoices, or general communications. Look up contact info with getUsers first.",
            inputSchema: z.object({
                to: z.string().describe("Recipient email address"),
                subject: z.string().describe("Email subject line"),
                body: z
                    .string()
                    .describe("Email body (HTML supported)"),
            }),
            execute: async ({ to, subject, body }) => {
                if (options.userRole !== "ADMIN") {
                    return {
                        error: "Only admins can send notifications.",
                    };
                }
                const result = await sendEmail(to, subject, body);
                await logAction(
                    "send_email",
                    { to, subject },
                    result
                );
                return result;
            },
        }),

        sendSmsNotification: tool({
            description:
                "Send an SMS to a foreman or crew member. ADMIN ONLY. Use for dispatch alerts or urgent schedule changes. Phone must include country code (+1...).",
            inputSchema: z.object({
                to: z
                    .string()
                    .describe(
                        "Phone number with country code (e.g. +15551234567)"
                    ),
                body: z
                    .string()
                    .describe(
                        "SMS message text (max 160 chars for single segment)"
                    ),
            }),
            execute: async ({ to, body }) => {
                if (options.userRole !== "ADMIN") {
                    return {
                        error: "Only admins can send notifications.",
                    };
                }
                const result = await sendSms(to, body);
                await logAction("send_sms", { to }, result);
                return result;
            },
        }),

        // ── Phase & Community Tools ───────────────────────────────────

        getPhasesByBuilder: tool({
            description:
                "Get phase definitions for a builder. Returns phase configs with service mappings.",
            inputSchema: z.object({
                builderId: z.string().describe("Builder ID"),
            }),
            execute: async ({ builderId }) => {
                const phases = await client.query(
                    api.blueBookPhases.getByBuilder,
                    { builderId: builderId as any }
                );
                return { count: phases.length, phases };
            },
        }),

        createPhaseConfig: tool({
            description:
                "Create a new phase definition for a builder. ADMIN ONLY.",
            inputSchema: z.object({
                builderId: z.string().describe("Builder ID"),
                code: z.string().describe("Phase code (e.g. 'ROUGH', 'FINAL')"),
                title: z.string().describe("Phase display title"),
                shorthand: z.string().describe("Short label"),
                serviceNames: z.array(z.string()).describe("Service names that belong to this phase"),
                sortOrder: z.number().describe("Display order (0-based)"),
            }),
            execute: async (args) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can create phase configs." };
                }
                const result = await client.mutation(
                    api.blueBookPhases.create,
                    { ...args, builderId: args.builderId as any }
                );
                await logAction("create_phase_config", args, result);
                return result;
            },
        }),

        updatePhaseConfig: tool({
            description:
                "Update a phase definition. ADMIN ONLY.",
            inputSchema: z.object({
                id: z.string().describe("Phase config ID"),
                title: z.string().optional(),
                shorthand: z.string().optional(),
                serviceNames: z.array(z.string()).optional(),
                sortOrder: z.number().optional(),
                active: z.boolean().optional(),
            }),
            execute: async (args) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can update phase configs." };
                }
                const result = await client.mutation(
                    api.blueBookPhases.update,
                    { ...args, id: args.id as any }
                );
                await logAction("update_phase_config", args, result);
                return result;
            },
        }),

        setPhaseOverride: tool({
            description:
                "Override phase completion status for a specific lot. Stored in DB (replaces localStorage).",
            inputSchema: z.object({
                builderId: z.string().describe("Builder ID"),
                communityId: z.string().describe("Community ID"),
                lot: z.string().describe("Lot number"),
                phaseCode: z.string().describe("Phase code"),
                phaseComplete: z.boolean().optional().describe("Override completion status"),
                serviceOverrides: z.string().optional().describe("JSON: { serviceName: boolean }"),
            }),
            execute: async (args) => {
                const result = await client.mutation(
                    api.blueBookPhases.setOverride,
                    {
                        builderId: args.builderId as any,
                        communityId: args.communityId as any,
                        lot: args.lot,
                        phaseCode: args.phaseCode,
                        phaseComplete: args.phaseComplete,
                        serviceOverrides: args.serviceOverrides,
                    }
                );
                return result;
            },
        }),

        resolveCommunity: tool({
            description:
                "Resolve a raw community name to a canonical community ID. Uses alias table + fuzzy matching.",
            inputSchema: z.object({
                rawName: z.string().describe("Raw community name to resolve"),
            }),
            execute: async ({ rawName }) => {
                return await client.query(
                    api.communityAliases.resolve,
                    { rawName }
                );
            },
        }),

        // ── Calendar & Email Integration Tools ────────────────────────

        syncJobToCalendar: tool({
            description:
                "Create a calendar event from a dispatched job. Requires the user to have connected their Microsoft or Google account via OAuth.",
            inputSchema: z.object({
                jobId: z.string().describe("Job request service ID to sync"),
                provider: z.enum(["google", "microsoft"]).describe("Calendar provider"),
            }),
            execute: async ({ jobId, provider }) => {
                // Calendar sync is handled server-side via the OAuth token refresh flow.
                // This tool returns guidance since direct calendar API calls happen in API routes.
                return {
                    message: `Calendar sync for ${provider} is available. Use the /api/calendar/sync endpoint with jobId=${jobId} and provider=${provider}.`,
                    provider,
                    jobId,
                    hint: "Connect your account in Settings > Integrations if not already connected.",
                };
            },
        }),

        getCalendarEvents: tool({
            description:
                "Get calendar events for a date range from the user's connected calendar (Microsoft or Google).",
            inputSchema: z.object({
                startDate: z.string().describe("Start date YYYY-MM-DD"),
                endDate: z.string().describe("End date YYYY-MM-DD"),
                provider: z.enum(["google", "microsoft"]).describe("Calendar provider"),
            }),
            execute: async ({ startDate, endDate, provider }) => {
                return {
                    message: `Calendar read for ${provider} from ${startDate} to ${endDate}.`,
                    hint: "Use /api/calendar/events endpoint. Requires OAuth connection.",
                    provider,
                    startDate,
                    endDate,
                };
            },
        }),

        // ── Self-Improvement Tools (Phase 7 — ADMIN only) ─────────────

        readInternalConfig: tool({
            description:
                "Read an AI config file (system prompt, tools, agents). ADMIN ONLY. Restricted to allowlisted paths.",
            inputSchema: z.object({
                filePath: z.string().describe("Path relative to repo root (e.g. 'lib/ai/system-prompt.ts')"),
            }),
            execute: async ({ filePath }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can read internal config files." };
                }

                const ALLOWLIST = [
                    "lib/ai/system-prompt.ts",
                    "lib/ai/tools.ts",
                    "AGENTS.md",
                ];
                if (!ALLOWLIST.includes(filePath)) {
                    return {
                        error: `Path "${filePath}" is not in the allowlist. Allowed: ${ALLOWLIST.join(", ")}`,
                    };
                }

                try {
                    const result = await readRepoFile(filePath);
                    const fileContent = typeof result === "string" ? result : result.content;
                    return { filePath, content: fileContent, length: fileContent.length };
                } catch (e: any) {
                    return { error: `Failed to read: ${e.message}` };
                }
            },
        }),

        updateInternalConfig: tool({
            description:
                "Update an AI config file via GitHub commit. ADMIN ONLY. Restricted to allowlisted paths. Auto-logged to audit trail.",
            inputSchema: z.object({
                filePath: z.string().describe("Path relative to repo root"),
                description: z.string().describe("What changed and why"),
                newContent: z.string().describe("Complete new file content"),
            }),
            execute: async ({ filePath, description, newContent }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can update internal configs." };
                }

                const ALLOWLIST = [
                    "lib/ai/system-prompt.ts",
                    "lib/ai/tools.ts",
                    "AGENTS.md",
                ];
                if (!ALLOWLIST.includes(filePath)) {
                    return {
                        error: `Path "${filePath}" is not in the allowlist. Allowed: ${ALLOWLIST.join(", ")}`,
                    };
                }

                // Guardrail: If updating tools.ts, verify allowlist check is preserved
                if (filePath === "lib/ai/tools.ts") {
                    if (!newContent.includes("ALLOWLIST") || !newContent.includes("userRole")) {
                        return {
                            error: "Self-update rejected: the new content for tools.ts must preserve the ALLOWLIST check and userRole guard. Cannot remove safety guardrails.",
                        };
                    }
                }

                try {
                    // Read current content for diff logging
                    let oldContent = "";
                    try {
                        const readResult = await readRepoFile(filePath);
                        oldContent = typeof readResult === "string" ? readResult : readResult.content;
                    } catch {
                        // File might not exist yet
                    }

                    const result = await writeRepoFile(
                        filePath,
                        newContent,
                        `[LUNAS AI Self-Update] ${description}`
                    );

                    await logAction("self-update", {
                        filePath,
                        description,
                        oldLength: oldContent.length,
                        newLength: newContent.length,
                    }, {
                        success: true,
                        commitSha: (result as any)?.sha,
                    });

                    return {
                        success: true,
                        filePath,
                        description,
                        message: `Config updated. ${description}`,
                    };
                } catch (e: any) {
                    return { error: `Self-update failed: ${e.message}` };
                }
            },
        }),

        addSystemPromptSection: tool({
            description:
                "Add a new section to the AI system prompt. Safer than full overwrite — reads current prompt, appends section, writes back. ADMIN ONLY.",
            inputSchema: z.object({
                sectionName: z.string().describe("Section heading (e.g. '## KB Homes Phases')"),
                content: z.string().describe("Section content to append"),
            }),
            execute: async ({ sectionName, content }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can modify the system prompt." };
                }

                try {
                    const readResult = await readRepoFile("lib/ai/system-prompt.ts");
                    const current = typeof readResult === "string" ? readResult : readResult.content;

                    // Find the closing backtick of the template literal
                    const insertPoint = current.lastIndexOf("## Instructions");
                    if (insertPoint === -1) {
                        return { error: "Could not find insertion point in system prompt." };
                    }

                    const updated = current.slice(0, insertPoint) +
                        `${sectionName}\n${content}\n\n` +
                        current.slice(insertPoint);

                    await writeRepoFile(
                        "lib/ai/system-prompt.ts",
                        updated,
                        `[LUNAS AI Self-Update] Add section: ${sectionName}`
                    );

                    await logAction("self-update-add-section", {
                        sectionName,
                        contentLength: content.length,
                    }, { success: true });

                    return {
                        success: true,
                        message: `Added "${sectionName}" section to system prompt.`,
                    };
                } catch (e: any) {
                    return { error: `Failed to add section: ${e.message}` };
                }
            },
        }),

        removeSystemPromptSection: tool({
            description:
                "Remove a named section from the AI system prompt. ADMIN ONLY.",
            inputSchema: z.object({
                sectionName: z.string().describe("Section heading to remove (e.g. '## KB Homes Phases')"),
            }),
            execute: async ({ sectionName }) => {
                if (options.userRole !== "ADMIN") {
                    return { error: "Only admins can modify the system prompt." };
                }

                // Safety: Cannot remove critical sections
                const PROTECTED_SECTIONS = [
                    "## Instructions",
                    "## Self-Improvement",
                    "## Code Quality Rules",
                    "## Your Role",
                    "## Current Context",
                ];
                if (PROTECTED_SECTIONS.some(s => sectionName.includes(s))) {
                    return {
                        error: `Cannot remove protected section "${sectionName}". Safety sections are not removable.`,
                    };
                }

                try {
                    const readResult = await readRepoFile("lib/ai/system-prompt.ts");
                    const current = typeof readResult === "string" ? readResult : readResult.content;

                    // Find the section and remove it (up to the next ## heading)
                    const sectionStart = current.indexOf(sectionName);
                    if (sectionStart === -1) {
                        return { error: `Section "${sectionName}" not found in system prompt.` };
                    }

                    // Find the next section heading after this one
                    const afterSection = current.indexOf("\n##", sectionStart + sectionName.length);
                    const sectionEnd = afterSection === -1 ? current.length : afterSection;

                    const updated = current.slice(0, sectionStart) + current.slice(sectionEnd);

                    await writeRepoFile(
                        "lib/ai/system-prompt.ts",
                        updated,
                        `[LUNAS AI Self-Update] Remove section: ${sectionName}`
                    );

                    await logAction("self-update-remove-section", {
                        sectionName,
                    }, { success: true });

                    return {
                        success: true,
                        message: `Removed "${sectionName}" section from system prompt.`,
                    };
                } catch (e: any) {
                    return { error: `Failed to remove section: ${e.message}` };
                }
            },
        }),
    };
}
