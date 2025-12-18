import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    // Users table
    users: defineTable({
        email: v.string(),
        name: v.optional(v.string()),
        phone: v.optional(v.string()),
        role: v.string(), // ADMIN, FOREMAN, CREW, etc
        passwordHash: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("by_email", ["email"])
        .index("by_role", ["role"]),

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
        createdAt: v.number(),
    }).index("by_name", ["name"]),

    // Communities
    communities: defineTable({
        name: v.string(),
        builderId: v.optional(v.id("builders")),
        createdAt: v.number(),
    })
        .index("by_name", ["name"])
        .index("by_builder", ["builderId"]),

    // Services
    services: defineTable({
        name: v.string(),
        description: v.optional(v.string()),
        createdAt: v.number(),
    }).index("by_name", ["name"]),

    // Model Plans
    modelPlans: defineTable({
        name: v.string(),
        communityId: v.optional(v.id("communities")),
        createdAt: v.number(),
    }).index("by_community", ["communityId"]),

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
        createdById: v.optional(v.id("users")),
        createdAt: v.number(),
    })
        .index("by_dueDate", ["dueDate"])
        .index("by_community", ["communityId"])
        .index("by_builder", ["builderId"]),

    // Job Request Services (individual service items within a job request)
    jobRequestServices: defineTable({
        jobRequestId: v.id("jobRequests"),
        serviceId: v.optional(v.id("services")),
        serviceName: v.optional(v.string()), // Denormalized for performance
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
        serviceId: v.optional(v.id("services")),
        accountCategoryCode: v.optional(v.string()),
        accountCategoryName: v.optional(v.string()),
        amount: v.optional(v.string()),
        poNumber: v.optional(v.string()),
        status: v.optional(v.string()),
        createdAt: v.number(),
    })
        .index("by_startDate", ["startDate"])
        .index("by_community", ["communityId"]),
});
