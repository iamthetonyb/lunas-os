import { pgTable, uuid, text, pgEnum, date, decimal, timestamp } from 'drizzle-orm/pg-core';
import { builders } from './builders';

export const invoiceStatusEnum = pgEnum('invoice_status', ['DRAFT', 'SENT', 'PAID', 'VOID']);

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  builderId: uuid('builder_id').references(() => builders.id),
  poNumber: text('po_number'),
  status: invoiceStatusEnum('status').default('DRAFT'),
  issuedOn: date('issued_on'),
  dueOn: date('due_on'),
  subtotal: decimal('subtotal'),
  tax: decimal('tax'),
  total: decimal('total'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
