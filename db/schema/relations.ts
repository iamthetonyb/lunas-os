import { relations } from 'drizzle-orm';
import { blueBookEntries } from './blue_book_entries';
import { builders } from './builders';
import { communities } from './communities';
import { services } from './services';
import { invoiceLines } from './invoice_lines';

export const blueBookEntryRelations = relations(blueBookEntries, ({ one }) => ({
  builder: one(builders, {
    fields: [blueBookEntries.builderId],
    references: [builders.id],
  }),
  community: one(communities, {
    fields: [blueBookEntries.communityId],
    references: [communities.id],
  }),
  service: one(services, {
    fields: [blueBookEntries.serviceId],
    references: [services.id],
  }),
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
