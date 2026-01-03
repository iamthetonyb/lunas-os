import { pgTable, uuid, timestamp, pgEnum, text, decimal, date, boolean } from 'drizzle-orm/pg-core';
import { builders } from './builders';
import { communities } from './communities';
import { modelPlans } from './model_plans';
import { services } from './services';
import { fieldTickets } from './field_tickets';
import { invoiceLines } from './invoice_lines';
import { jobRequestServices } from './job_request_services';
import { crews } from './crews';
import { dispatchBatches } from './dispatch_batches';

// Removed circular import of blue_book_entries



export const blueBookStatusEnum = pgEnum('blue_book_status', ['PENDING', 'COMPLETE']);

export const blueBookEntries = pgTable('blue_book_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  builderId: uuid('builder_id').references(() => builders.id),
  communityId: uuid('community_id').references(() => communities.id),
  lot: text('lot'),
  modelPlanId: uuid('model_plan_id').references(() => modelPlans.id),
  serviceId: uuid('service_id').references(() => services.id),
  poNumber: text('po_number'),
  status: blueBookStatusEnum('status').default('PENDING'),
  assignmentId: uuid('assignment_id'), // fk ref removed to break circular type inference
  ticketId: uuid('ticket_id').references(() => fieldTickets.id),
  invoiceLineId: uuid('invoice_line_id').references(() => invoiceLines.id),
  amount: decimal('amount'),
  checkNumber: text('check_number'),
  checkDate: date('check_date'),
  checkTotal: decimal('check_total'),
  isAch: boolean('is_ach').default(false),
  accountCategoryCode: text('account_category_code'),
  accountCategoryName: text('account_category_name'),
  startDate: date('start_date'),
  originalStartDate: date('original_start_date'),
  assignedForemanName: text('assigned_foreman_name'),
  source: text('source').default('scraped'), // 'scraped' or 'manual'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const assignmentStatusEnum = pgEnum('assignment_status', ['DRAFT', 'SENT', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETE', 'NOT_DONE', 'DISPATCHED']);

export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobRequestServiceId: uuid('job_request_service_id').references(() => jobRequestServices.id),
  blueBookEntryId: uuid('blue_book_entry_id').references(() => blueBookEntries.id),
  crewId: uuid('crew_id').references(() => crews.id),
  dispatchBatchId: uuid('dispatch_batch_id').references(() => dispatchBatches.id),
  scheduledStart: timestamp('scheduled_start'),
  scheduledEnd: timestamp('scheduled_end'),
  status: assignmentStatusEnum('status').default('DRAFT'),
  notes: text('notes'),
});
