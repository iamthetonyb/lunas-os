"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoices = exports.invoiceStatusEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const builders_1 = require("./builders");
exports.invoiceStatusEnum = (0, pg_core_1.pgEnum)('invoice_status', ['DRAFT', 'SENT', 'PAID', 'VOID']);
exports.invoices = (0, pg_core_1.pgTable)('invoices', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    builderId: (0, pg_core_1.uuid)('builder_id').references(() => builders_1.builders.id),
    poNumber: (0, pg_core_1.text)('po_number'),
    status: (0, exports.invoiceStatusEnum)('status').default('DRAFT'),
    issuedOn: (0, pg_core_1.date)('issued_on'),
    dueOn: (0, pg_core_1.date)('due_on'),
    subtotal: (0, pg_core_1.decimal)('subtotal'),
    tax: (0, pg_core_1.decimal)('tax'),
    total: (0, pg_core_1.decimal)('total'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
