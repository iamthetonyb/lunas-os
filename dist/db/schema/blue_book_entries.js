"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blueBookEntries = exports.blueBookStatusEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const builders_1 = require("./builders");
const communities_1 = require("./communities");
const model_plans_1 = require("./model_plans");
const services_1 = require("./services");
const assignments_1 = require("./assignments");
const field_tickets_1 = require("./field_tickets");
const invoice_lines_1 = require("./invoice_lines");
exports.blueBookStatusEnum = (0, pg_core_1.pgEnum)('blue_book_status', ['PENDING', 'COMPLETE']);
exports.blueBookEntries = (0, pg_core_1.pgTable)('blue_book_entries', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    builderId: (0, pg_core_1.uuid)('builder_id').references(() => builders_1.builders.id),
    communityId: (0, pg_core_1.uuid)('community_id').references(() => communities_1.communities.id),
    lot: (0, pg_core_1.text)('lot'),
    modelPlanId: (0, pg_core_1.uuid)('model_plan_id').references(() => model_plans_1.modelPlans.id),
    serviceId: (0, pg_core_1.uuid)('service_id').references(() => services_1.services.id),
    poNumber: (0, pg_core_1.text)('po_number'),
    status: (0, exports.blueBookStatusEnum)('status').default('PENDING'),
    assignmentId: (0, pg_core_1.uuid)('assignment_id').references(() => assignments_1.assignments.id),
    ticketId: (0, pg_core_1.uuid)('ticket_id').references(() => field_tickets_1.fieldTickets.id),
    invoiceLineId: (0, pg_core_1.uuid)('invoice_line_id').references(() => invoice_lines_1.invoiceLines.id),
    amount: (0, pg_core_1.decimal)('amount'),
    accountCategoryCode: (0, pg_core_1.text)('account_category_code'),
    accountCategoryName: (0, pg_core_1.text)('account_category_name'),
    startDate: (0, pg_core_1.date)('start_date'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
