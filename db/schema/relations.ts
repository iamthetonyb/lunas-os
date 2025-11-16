import { relations } from 'drizzle-orm';
import { blueBookEntries } from './blue_book_entries';
import { builders } from './builders';
import { communities } from './communities';
import { services } from './services';
import { modelPlans } from './model_plans';
import { invoiceLines } from './invoice_lines';
import { orgs } from './orgs';
import { orgMembers } from './org_members';
import { serviceLogs } from './service_logs';
import { users } from './users';

export const blueBookEntryRelations = relations(blueBookEntries, ({ one }) => ({
  builder: one(builders, {
    fields: [blueBookEntries.builderId],
    references: [builders.id],
  }),
  community: one(communities, {
    fields: [blueBookEntries.communityId],
    references: [communities.id],
  }),
  modelPlan: one(modelPlans, {
    fields: [blueBookEntries.modelPlanId],
    references: [modelPlans.id],
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

export const orgRelations = relations(orgs, ({ many }) => ({
  members: many(orgMembers),
  serviceLogs: many(serviceLogs),
}));

export const orgMemberRelations = relations(orgMembers, ({ one }) => ({
  org: one(orgs, {
    fields: [orgMembers.orgId],
    references: [orgs.id],
  }),
  user: one(users, {
    fields: [orgMembers.userId],
    references: [users.id],
  }),
}));

export const serviceLogRelations = relations(serviceLogs, ({ one }) => ({
  org: one(orgs, {
    fields: [serviceLogs.orgId],
    references: [orgs.id],
  }),
  author: one(users, {
    fields: [serviceLogs.createdBy],
    references: [users.id],
  }),
}));
