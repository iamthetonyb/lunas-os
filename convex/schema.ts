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
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_email", ["email"])
        .index("by_role", ["role"])
        .index("by_resetToken", ["resetToken"]),

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
    }).index("by_name", ["name"]),

    // Communities
    communities: defineTable({
        name: v.string(),
        builderId: v.optional(v.id("builders")),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        active: v.optional(v.boolean()),
        createdAt: v.number(),
    })
        .index("by_name", ["name"])
        .index("by_builder", ["builderId"]),

    // Services
    services: defineTable({
        name: v.string(),
        description: v.optional(v.string()),
        code: v.optional(v.string()),
        category: v.optional(v.string()),
        unitKind: v.optional(v.string()), // PER_JOB, PER_SQFT, PER_UNIT
        active: v.optional(v.boolean()),
        createdAt: v.number(),
    })
        .index("by_name", ["name"])
        .index("by_code", ["code"]),

    // Model Plans
    modelPlans: defineTable({
        name: v.string(),
        communityId: v.optional(v.id("communities")),
        builderId: v.optional(v.id("builders")),
        code: v.optional(v.string()),
        sqft: v.optional(v.string()),
        defaults: v.optional(v.string()),
        active: v.optional(v.boolean()),
        createdAt: v.number(),
    })
        .index("by_community", ["communityId"])
        .index("by_builder", ["builderId"]),

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
        createdById: v.optional(v.id("users")),
        createdAt: v.number(),
    })
        .index("by_dueDate", ["dueDate"])
        .index("by_community", ["communityId"])
        .index("by_builder", ["builderId"])
        .index("by_createdAt", ["createdAt"]),

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
        .index("by_scheduledDate", ["scheduledDate"]),

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
        .index("by_foreman", ["foremanName"]),

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
        .index("by_status", ["status"]),

    // Blue Book Entries (scraped data)
    blueBookEntries: defineTable({
        startDate: v.optional(v.string()),
        builderId: v.optional(v.id("builders")),
        communityId: v.optional(v.id("communities")),
        lot: v.optional(v.string()),
        modelPlanId: v.optional(v.id("modelPlans")),
        modelPlanName: v.optional(v.string()),
        serviceId: v.optional(v.id("services")),
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
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_startDate", ["startDate"])
        .index("by_community", ["communityId"])
        .index("by_builder", ["builderId"])
        .index("by_status", ["status"]),

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
        .index("by_service", ["serviceId"]),

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
        jobNumber: v.optional(v.string()),
        lotNumber: v.optional(v.string()),
        address: v.optional(v.string()),
        model: v.optional(v.string()),
        status: v.optional(v.string()),
        createdAt: v.number(),
    }).index("by_community", ["communityId"]),
});
