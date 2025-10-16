"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobRequests = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const builders_1 = require("./builders");
const communities_1 = require("./communities");
const model_plans_1 = require("./model_plans");
const users_1 = require("./users");
exports.jobRequests = (0, pg_core_1.pgTable)('job_requests', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    receivedVia: (0, pg_core_1.text)('received_via'),
    requestedBy: (0, pg_core_1.text)('requested_by'),
    contactPhone: (0, pg_core_1.text)('contact_phone'),
    contactEmail: (0, pg_core_1.text)('contact_email'),
    builderId: (0, pg_core_1.uuid)('builder_id').references(() => builders_1.builders.id),
    communityId: (0, pg_core_1.uuid)('community_id').references(() => communities_1.communities.id),
    lot: (0, pg_core_1.text)('lot'),
    address: (0, pg_core_1.text)('address'),
    modelPlanId: (0, pg_core_1.uuid)('model_plan_id').references(() => model_plans_1.modelPlans.id),
    dueDate: (0, pg_core_1.date)('due_date'),
    notes: (0, pg_core_1.text)('notes'),
    poNumber: (0, pg_core_1.text)('po_number'),
    createdById: (0, pg_core_1.uuid)('created_by_id').references(() => users_1.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
