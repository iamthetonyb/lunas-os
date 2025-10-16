import { relations } from 'drizzle-orm';
import { blueBookEntries } from './blue_book_entries';
import { invoiceLines } from './invoice_lines';

export const blueBookEntryRelations = relations(blueBookEntries, ({ one }) => ({
  invoiceLine: one(invoiceLines, {
    fields: [blueBookEntries.invoiceLineId],
    references: [invoiceLines.id],
  }),
}));

export const invoiceLineRelations = relations(invoiceLines, ({ one }) => ({
  blueBookEntry: one(blueBookEntries, {
    fields: [invoiceLines.blueBookId],
    references: [blueBookEntries.id],
  }),
}));
