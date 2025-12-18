import { pgTable, text, uuid, date, json, timestamp } from 'drizzle-orm/pg-core';
import { builders } from './builders';
import { communities } from './communities';
import { modelPlans } from './model_plans';
import { users } from './users';

export const jobRequests = pgTable('job_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  receivedVia: text('received_via'),
  requestedBy: text('requested_by'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  builderId: uuid('builder_id').references(() => builders.id),
  communityId: uuid('community_id').references(() => communities.id),
  lot: text('lot'),
  address: text('address'),
  modelPlanId: uuid('model_plan_id').references(() => modelPlans.id),
  dueDate: date('due_date'),
  originalDueDate: date('original_due_date'),
  notes: text('notes'),
  poNumber: text('po_number'),
  createdById: uuid('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
