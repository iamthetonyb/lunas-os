"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fieldTickets = exports.ticketStatusEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const assignments_1 = require("./assignments");
const users_1 = require("./users");
exports.ticketStatusEnum = (0, pg_core_1.pgEnum)('ticket_status', ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);
exports.fieldTickets = (0, pg_core_1.pgTable)('field_tickets', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    assignmentId: (0, pg_core_1.uuid)('assignment_id').references(() => assignments_1.assignments.id).unique(),
    submittedById: (0, pg_core_1.uuid)('submitted_by_id').references(() => users_1.users.id),
    submittedAt: (0, pg_core_1.timestamp)('submitted_at'),
    status: (0, exports.ticketStatusEnum)('status').default('DRAFT'),
    items: (0, pg_core_1.json)('items'),
    notes: (0, pg_core_1.text)('notes'),
    customerSig: (0, pg_core_1.text)('customer_sig'),
    foremanSig: (0, pg_core_1.text)('foreman_sig'),
    ticketPdfUrl: (0, pg_core_1.text)('ticket_pdf_url'),
});
