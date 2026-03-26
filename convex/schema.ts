import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    // Users table
    users: defineTable({
        email: v.string(),
        name: v.optional(v.string()),
        phone: v.optional(v.string()),
        role: v.string(), // ADMIN, FOREMAN, CREW, CUSTOMER, etc
        passwordHash: v.optional(v.string()),
        preferredLang: v.optional(v.string()), // EN, ES_MX
        preferredContactMethod: v.optional(v.string()), // email, call, text
        resetToken: v.optional(v.string()),
        resetTokenExpiry: v.optional(v.number()),
        active: v.optional(v.boolean()),
        // GHL-style granular permissions — JSON string of { section: { enabled, permissions: { key: bool } } }
        permissions: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_email", ["email"])
        .index("by_role", ["role"])
        .index("by_resetToken", ["resetToken"])
        .index("by_name", ["name"])
        .index("by_active", ["active"]),

    // Organizations
    orgs: defineTable({
        name: v.string(),
        slug: v.string(),
        createdAt: v.number(),
    }).index("by_slug", ["slug"]),

    // Organization members (user-org relationship)
    orgMembers: defineTable({
        orgId: v.id("orgs"),
        userId: v.id("users"),
        role: v.string(), // admin, backoffice, contractor
        createdAt: v.number(),
    })
        .index("by_org", ["orgId"])
        .index("by_user", ["userId"])
        .index("by_org_user", ["orgId", "userId"]),

    // Builders
    builders: defineTable({
        name: v.string(),
        active: v.optional(v.boolean()),
        createdAt: v.number(),
    })
        .index("by_name", ["name"])
        .index("by_active", ["active"]),

    // Communities
    communities: defineTable({
        name: v.string(),
        normalizedName: v.optional(v.string()), // lowercased/trimmed for fuzzy matching
        builderId: v.optional(v.id("builders")),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        active: v.optional(v.boolean()),
        createdAt: v.number(),
    })
        .index("by_name", ["name"])
        .index("by_builder", ["builderId"])
        .index("by_active", ["active"])
        .index("by_normalizedName", ["normalizedName"]),

    // Services
    services: defineTable({
        name: v.string(),
        normalizedName: v.optional(v.string()),
        description: v.optional(v.string()),
        code: v.optional(v.string()),
        category: v.optional(v.string()),
        unitKind: v.optional(v.string()), // PER_JOB, PER_SQFT, PER_UNIT
        active: v.optional(v.boolean()),
        createdAt: v.number(),
    })
        .index("by_name", ["name"])
        .index("by_normalizedName", ["normalizedName"])
        .index("by_code", ["code"])
        .index("by_active", ["active"]),

    // Model Plans
    modelPlans: defineTable({
        name: v.string(),
        normalizedName: v.optional(v.string()),
        communityId: v.optional(v.id("communities")),
        builderId: v.optional(v.id("builders")),
        code: v.optional(v.string()),
        sqft: v.optional(v.string()),
        defaults: v.optional(v.string()),
        active: v.optional(v.boolean()),
        createdAt: v.number(),
    })
        .index("by_community", ["communityId"])
        .index("by_builder", ["builderId"])
        .index("by_active", ["active"])
        .index("by_normalizedName", ["normalizedName"])
        .index("by_community_name", ["communityId", "normalizedName"]),

    // Crews
    crews: defineTable({
        name: v.string(),
        foremanId: v.optional(v.id("users")),
        skills: v.optional(v.array(v.string())),
        capacityPerDay: v.optional(v.number()),
        createdAt: v.number(),
    }).index("by_foreman", ["foremanId"]),

    // Job Requests (from intake)
    jobRequests: defineTable({
        receivedVia: v.optional(v.string()),
        requestedBy: v.optional(v.string()),
        contactPhone: v.optional(v.string()),
        contactEmail: v.optional(v.string()),
        builderId: v.optional(v.id("builders")),
        communityId: v.optional(v.id("communities")),
        lot: v.optional(v.string()),
        address: v.optional(v.string()),
        modelPlanId: v.optional(v.id("modelPlans")),
        dueDate: v.optional(v.string()),
        notes: v.optional(v.string()),
        poNumber: v.optional(v.string()),
        isExtraWork: v.optional(v.boolean()),
        amount: v.optional(v.string()),
        status: v.optional(v.string()),
        // Extra work fields (from paper form)
        awrNumber: v.optional(v.string()), // Additional Work Request # (Lunas reference)
        serviceDate: v.optional(v.string()), // Date service was performed
        superintendent: v.optional(v.string()), // Lunas foreman/super assigned
        requestedByEmail: v.optional(v.string()), // Email for invoice delivery
        invoiceNumber: v.optional(v.string()), // E# reference (e.g. E-60482)
        createdById: v.optional(v.id("users")),
        createdAt: v.number(),
    })
        .index("by_dueDate", ["dueDate"])
        .index("by_community", ["communityId"])
        .index("by_builder", ["builderId"])
        .index("by_createdAt", ["createdAt"])
        .index("by_builder_status", ["builderId", "status"])
        .index("by_community_createdAt", ["communityId", "createdAt"])
        .index("by_status", ["status"]),

    // Job Request Services (individual service items within a job request)
    jobRequestServices: defineTable({
        jobRequestId: v.id("jobRequests"),
        serviceId: v.optional(v.id("services")),
        serviceName: v.optional(v.string()),
        walkTime: v.optional(v.string()),
        assignedForemanName: v.optional(v.string()),
        assignedCrewName: v.optional(v.string()),
        status: v.string(), // PENDING, SCHEDULED, DISPATCHED, COMPLETE
        scheduledDate: v.optional(v.string()),
        rescheduledDate: v.optional(v.string()),
        rescheduledReason: v.optional(v.string()),
        createdAt: v.number(),
    })
        .index("by_jobRequest", ["jobRequestId"])
        .index("by_status", ["status"])
        .index("by_foreman", ["assignedForemanName"])
        .index("by_scheduledDate", ["scheduledDate"])
        .index("by_status_scheduledDate", ["status", "scheduledDate"])
        .index("by_jobRequest_status", ["jobRequestId", "status"]),

    // Dispatch Batches
    dispatchBatches: defineTable({
        serviceDate: v.optional(v.string()),
        status: v.string(), // DRAFT, SENT, IN_PROGRESS, COMPLETE
        crewName: v.optional(v.string()),
        foremanName: v.optional(v.string()),
        notes: v.optional(v.string()),
        createdById: v.optional(v.id("users")),
        createdAt: v.number(),
    })
        .index("by_serviceDate", ["serviceDate"])
        .index("by_status", ["status"])
        .index("by_foreman", ["foremanName"])
        .index("by_status_serviceDate", ["status", "serviceDate"]),

    // Assignments (links job request services to dispatch batches)
    assignments: defineTable({
        jobRequestServiceId: v.id("jobRequestServices"),
        dispatchBatchId: v.optional(v.id("dispatchBatches")),
        crewId: v.optional(v.id("crews")),
        scheduledStart: v.optional(v.number()),
        scheduledEnd: v.optional(v.number()),
        status: v.string(), // DRAFT, SENT, ACCEPTED, IN_PROGRESS, COMPLETE, NOT_DONE
        notes: v.optional(v.string()),
        windows: v.optional(v.string()),
        tubs: v.optional(v.string()),
        foremanSig: v.optional(v.string()),
        customerSig: v.optional(v.string()),
        createdAt: v.number(),
    })
        .index("by_batch", ["dispatchBatchId"])
        .index("by_jobRequestService", ["jobRequestServiceId"])
        .index("by_status", ["status"])
        .index("by_batch_status", ["dispatchBatchId", "status"]),

    // Blue Book Entries (scraped data + auto-created from intakes)
    blueBookEntries: defineTable({
        startDate: v.optional(v.string()),
        startDateNum: v.optional(v.number()), // epoch ms for indexed sorting
        builderId: v.optional(v.id("builders")),
        communityId: v.optional(v.id("communities")),
        lot: v.optional(v.string()),
        modelPlanId: v.optional(v.id("modelPlans")),
        modelPlanName: v.optional(v.string()),
        serviceId: v.optional(v.id("services")),
        // Link to job request for auto-created entries (enables real-time sync)
        jobRequestId: v.optional(v.id("jobRequests")),
        jobRequestServiceId: v.optional(v.id("jobRequestServices")),
        // Denormalized fields for fast reads without joins
        builderName: v.optional(v.string()),
        communityName: v.optional(v.string()),
        serviceName: v.optional(v.string()),
        modelPlanCode: v.optional(v.string()),
        modelPlanSqft: v.optional(v.string()),
        accountCategoryCode: v.optional(v.string()),
        accountCategoryName: v.optional(v.string()),
        amount: v.optional(v.string()),
        poNumber: v.optional(v.string()),
        status: v.optional(v.string()),
        invoiceNumber: v.optional(v.string()),
        invoiceLineId: v.optional(v.id("invoiceLines")),
        checkNumber: v.optional(v.string()),
        checkDate: v.optional(v.string()),
        checkTotal: v.optional(v.string()),
        isAch: v.optional(v.boolean()),
        assignedForemanName: v.optional(v.string()),
        crewName: v.optional(v.string()),
        source: v.optional(v.string()),
        // Billing status tracking — maps to cell colors from uploaded Excel files
        // 'invoiced_paid' (green), 'admin_paid' (blue), 'none' (white/default)
        billingStatus: v.optional(v.string()),
        // Preserve original upload ordering (row index within an import batch)
        importOrder: v.optional(v.number()),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_startDate", ["startDate"])
        .index("by_community", ["communityId"])
        .index("by_builder", ["builderId"])
        .index("by_status", ["status"])
        .index("by_builder_startDateNum", ["builderId", "startDateNum"])
        .index("by_builder_community", ["builderId", "communityId"])
        .index("by_builder_status", ["builderId", "status"])
        .index("by_jobRequestService", ["jobRequestServiceId"])
        .index("by_jobRequest", ["jobRequestId"]),

    // Contract Rates
    contractRates: defineTable({
        builderId: v.optional(v.id("builders")),
        serviceId: v.optional(v.id("services")),
        modelPlanId: v.optional(v.id("modelPlans")),
        basis: v.optional(v.string()),
        rate: v.optional(v.string()),
        unitLabel: v.optional(v.string()),
        effectiveOn: v.optional(v.string()),
        expiresOn: v.optional(v.string()),
        active: v.optional(v.boolean()),
        createdAt: v.number(),
    })
        .index("by_builder", ["builderId"])
        .index("by_service", ["serviceId"])
        .index("by_builder_service", ["builderId", "serviceId"]),

    // Invoices
    invoices: defineTable({
        builderId: v.optional(v.id("builders")),
        poNumber: v.optional(v.string()),
        status: v.optional(v.string()), // DRAFT, SENT, PAID, VOID
        issuedOn: v.optional(v.string()),
        dueOn: v.optional(v.string()),
        subtotal: v.optional(v.number()),
        tax: v.optional(v.number()),
        total: v.optional(v.number()),
        createdAt: v.number(),
    })
        .index("by_builder", ["builderId"])
        .index("by_status", ["status"]),

    // Invoice Lines
    invoiceLines: defineTable({
        invoiceId: v.id("invoices"),
        blueBookId: v.optional(v.id("blueBookEntries")),
        description: v.optional(v.string()),
        qty: v.optional(v.number()),
        unit: v.optional(v.string()),
        unitPrice: v.optional(v.number()),
        amount: v.optional(v.number()),
    }).index("by_invoice", ["invoiceId"]),

    // AI Messages (conversation history for persistence)
    aiMessages: defineTable({
        threadId: v.string(),
        userId: v.optional(v.id("users")),
        role: v.string(), // user, assistant, system
        content: v.string(),
        toolCalls: v.optional(v.string()), // JSON serialized tool calls
        createdAt: v.number(),
    })
        .index("by_thread", ["threadId"])
        .index("by_user", ["userId"]),

    // AI Decision Log (audit trail for autonomous actions)
    aiDecisionLog: defineTable({
        action: v.string(), // e.g. "auto_assign_foreman", "auto_dispatch"
        input: v.string(), // JSON — what triggered the decision
        output: v.string(), // JSON — what action was taken
        confidence: v.optional(v.number()), // 0-1
        approved: v.optional(v.boolean()),
        approvedBy: v.optional(v.id("users")),
        source: v.optional(v.string()), // "chat", "auto", "scheduled"
        createdAt: v.number(),
    })
        .index("by_action", ["action"])
        .index("by_createdAt", ["createdAt"]),

    // Community Lots
    communityLots: defineTable({
        communityId: v.id("communities"),
        modelPlanId: v.optional(v.id("modelPlans")),
        jobNumber: v.optional(v.string()),
        lotNumber: v.optional(v.string()),
        address: v.optional(v.string()),
        model: v.optional(v.string()),
        status: v.optional(v.string()),
        createdAt: v.number(),
    })
        .index("by_community", ["communityId"])
        .index("by_modelPlan", ["modelPlanId"]),

    // ── NEW TABLES (Phase 1) ────────────────────────────────────────────

    // Builder Phase Configs — per-builder phase definitions (replaces hardcoded KNOWN_PHASES)
    builderPhaseConfigs: defineTable({
        builderId: v.id("builders"),
        code: v.string(),
        title: v.string(),
        shorthand: v.string(),
        serviceNames: v.array(v.string()),
        sortOrder: v.number(),
        active: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_builder", ["builderId"])
        .index("by_builder_code", ["builderId", "code"]),

    // Community Phase Configs — per-community phase definitions (overrides builder defaults)
    communityPhaseConfigs: defineTable({
        communityId: v.id("communities"),
        builderId: v.optional(v.id("builders")),
        code: v.string(),
        title: v.string(),
        shorthand: v.string(),
        serviceNames: v.array(v.string()),
        sortOrder: v.number(),
        active: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_community", ["communityId"])
        .index("by_community_code", ["communityId", "code"]),

    // Phase Overrides — replaces localStorage (persisted, cross-device)
    phaseOverrides: defineTable({
        lotKey: v.string(), // `${communityId}:${lot}`
        builderId: v.id("builders"),
        communityId: v.id("communities"),
        lot: v.string(),
        phaseCode: v.string(),
        phaseComplete: v.optional(v.boolean()),
        serviceOverrides: v.optional(v.string()), // JSON: { serviceName: boolean }
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_lotKey", ["lotKey"])
        .index("by_builder_community", ["builderId", "communityId"]),

    // Community Aliases — maps scraped name variants to canonical community records
    communityAliases: defineTable({
        alias: v.string(), // lowercased/trimmed
        communityId: v.id("communities"),
        builderId: v.optional(v.id("builders")),
        createdAt: v.number(),
    })
        .index("by_alias", ["alias"])
        .index("by_community", ["communityId"]),

    // OAuth Accounts — OAuth token storage for Microsoft/Google
    oauthAccounts: defineTable({
        userId: v.id("users"),
        provider: v.string(), // "google" | "microsoft"
        providerAccountId: v.string(),
        accessToken: v.string(),
        refreshToken: v.optional(v.string()),
        expiresAt: v.number(), // epoch ms
        scope: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_user", ["userId"])
        .index("by_provider_account", ["provider", "providerAccountId"]),

    // Import History — tracks uploaded documents for dedup + audit
    importHistory: defineTable({
        fileName: v.string(),
        fileHash: v.string(), // SHA-256 of file content for dedup
        fileSize: v.number(),
        documentType: v.optional(v.string()), // detected type from OCR
        detectedTargets: v.array(v.string()), // which targets were selected
        rowCount: v.number(),
        results: v.string(), // JSON: { target: { success, errors } }
        fieldMapping: v.optional(v.string()), // JSON of field mapping used
        parsedRows: v.optional(v.string()), // JSON: mapped row data (fields user chose)
        rawRows: v.optional(v.string()), // JSON: full extraction (all fields from OCR/parse)
        deletedAt: v.optional(v.number()), // soft delete timestamp
        createdAt: v.number(),
    })
        .index("by_fileHash", ["fileHash"])
        .index("by_createdAt", ["createdAt"])
        .index("by_deletedAt", ["deletedAt"]),

    // Imported Entities — links import records to created system entities
    importedEntities: defineTable({
        importId: v.id("importHistory"),
        entityType: v.string(), // "builder" | "community" | "service" | "blueBookEntry" | "jobRequest"
        entityId: v.string(), // ID of the created/resolved entity
        rowIndex: v.number(), // which row in the import this came from
        mappedData: v.string(), // JSON of the mapped row data at import time
        existed: v.optional(v.boolean()), // true if entity existed before import
        deactivated: v.optional(v.boolean()), // true if entity was deactivated during soft-delete
        createdAt: v.number(),
    })
        .index("by_import", ["importId"])
        .index("by_entity", ["entityType", "entityId"]),

    // Work Logs — crew/foreman daily work submissions (survey-style)
    workLogs: defineTable({
        userId: v.optional(v.id("users")), // optional for public/anonymous submissions
        userName: v.optional(v.string()),
        date: v.string(), // YYYY-MM-DD
        time: v.optional(v.string()), // HH:MM
        communityId: v.optional(v.id("communities")),
        communityName: v.optional(v.string()),
        builderId: v.optional(v.id("builders")),
        builderName: v.optional(v.string()),
        serviceType: v.string(), // e.g. "Final Clean", "QA", "Tubs / Windows", "Frame Sweep"
        serviceChecks: v.optional(v.array(v.string())), // checkbox selections from paper form
        lots: v.string(), // "Lot 13,14,15" — can be multiple
        sqft: v.optional(v.number()),
        amount: v.optional(v.number()),
        isExtraWork: v.optional(v.boolean()),
        extraWorkDescription: v.optional(v.string()),
        workExplanation: v.optional(v.string()), // "Explain work completed" from paper form
        notes: v.optional(v.string()),
        subContractorName: v.optional(v.string()),
        windowCount: v.optional(v.number()), // for tubs/windows jobs
        hoursWorked: v.optional(v.number()), // for hourly/extra work
        // Paper form fields
        crewLeader: v.optional(v.string()),
        numWorkers: v.optional(v.number()),
        supervisor: v.optional(v.string()),
        team: v.optional(v.string()),
        // Verification flow: foreman verifies crew → admin verifies final
        status: v.string(), // DRAFT, SUBMITTED, VERIFIED, FLAGGED
        flagReason: v.optional(v.string()),
        foremanVerified: v.optional(v.boolean()),
        foremanVerifiedBy: v.optional(v.id("users")),
        foremanVerifiedAt: v.optional(v.number()),
        verifiedBy: v.optional(v.id("users")),
        verifiedAt: v.optional(v.number()),
        // Links to system records for cross-reference
        blueBookEntryId: v.optional(v.id("blueBookEntries")),
        extraWorkJobRequestId: v.optional(v.id("jobRequests")), // auto-created when extra work
        jobRequestServiceId: v.optional(v.id("jobRequestServices")),
        assignmentValidated: v.optional(v.boolean()), // true if work matches an assignment
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_user", ["userId"])
        .index("by_date", ["date"])
        .index("by_user_date", ["userId", "date"])
        .index("by_community", ["communityId"])
        .index("by_status", ["status"])
        .index("by_createdAt", ["createdAt"]),

    // ── Chat & Notifications ──────────────────────────────────────────

    // Conversations — DMs and group chats
    conversations: defineTable({
        type: v.string(), // "direct" | "group"
        name: v.optional(v.string()), // group name (optional for DMs)
        createdBy: v.id("users"),
        lastMessageAt: v.optional(v.number()),
        lastMessagePreview: v.optional(v.string()),
        createdAt: v.number(),
    })
        .index("by_lastMessageAt", ["lastMessageAt"]),

    // Conversation Members — who's in each conversation
    conversationMembers: defineTable({
        conversationId: v.id("conversations"),
        userId: v.id("users"),
        lastReadAt: v.optional(v.number()),
        joinedAt: v.number(),
        visibleFrom: v.optional(v.number()), // earliest message timestamp this member can see (null = all history)
    })
        .index("by_user", ["userId"])
        .index("by_conversation", ["conversationId"])
        .index("by_user_conversation", ["userId", "conversationId"]),

    // Messages — chat messages within conversations
    messages: defineTable({
        conversationId: v.id("conversations"),
        senderId: v.id("users"),
        senderName: v.optional(v.string()),
        body: v.string(),
        createdAt: v.number(),
    })
        .index("by_conversation", ["conversationId", "createdAt"]),

    // Notifications — system-wide notifications (requests, approvals, messages, etc.)
    notifications: defineTable({
        userId: v.id("users"), // recipient
        type: v.string(), // message, job_request, dispatch, approval, work_log, system
        title: v.string(),
        body: v.optional(v.string()),
        relatedId: v.optional(v.string()), // generic ID for deep-linking
        relatedType: v.optional(v.string()), // jobRequest, dispatch, workLog, conversation, etc.
        conversationId: v.optional(v.id("conversations")),
        read: v.boolean(),
        createdAt: v.number(),
    })
        .index("by_user_read", ["userId", "read"])
        .index("by_user_createdAt", ["userId", "createdAt"])
        .index("by_createdAt", ["createdAt"]),

    // Foreman Affinity Cache — pre-computed affinity data (updated by weekly insight pipeline)
    foremanAffinityCache: defineTable({
        communityId: v.id("communities"),
        communityName: v.string(),
        foremanName: v.string(),
        assignmentCount: v.number(),
        percentage: v.number(), // 0-100
        isBackup: v.boolean(),
        computedAt: v.number(),
    })
        .index("by_community", ["communityId"])
        .index("by_foreman", ["foremanName"]),
});
