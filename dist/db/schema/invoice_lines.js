"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceLines = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const invoices_1 = require("./invoices");
exports.invoiceLines = (0, pg_core_1.pgTable)('invoice_lines', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    invoiceId: (0, pg_core_1.uuid)('invoice_id').references(() => invoices_1.invoices.id),
    blueBookId: (0, pg_core_1.uuid)('blue_book_id'),
    description: (0, pg_core_1.text)('description'),
    qty: (0, pg_core_1.decimal)('qty'),
    unit: (0, pg_core_1.text)('unit'),
    unitPrice: (0, pg_core_1.decimal)('unit_price'),
    amount: (0, pg_core_1.decimal)('amount'),
});
