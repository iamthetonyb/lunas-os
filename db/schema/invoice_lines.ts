import { pgTable, uuid, text, decimal } from 'drizzle-orm/pg-core';
import { invoices } from './invoices';

export const invoiceLines = pgTable('invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  blueBookId: uuid('blue_book_id'),
  description: text('description'),
  qty: decimal('qty'),
  unit: text('unit'),
  unitPrice: decimal('unit_price'),
  amount: decimal('amount'),
});
