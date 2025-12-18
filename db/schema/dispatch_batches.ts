import { pgTable, uuid, date, pgEnum, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const dispatchStatusEnum = pgEnum('dispatch_status', ['DRAFT', 'SENT']);

export const dispatchBatches = pgTable('dispatch_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  serviceDate: date('service_date'),
  status: dispatchStatusEnum('status').default('DRAFT'),
  crewName: text('crew_name'),
  foremanName: text('foreman_name'),
  notes: text('notes'),
  createdById: uuid('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
