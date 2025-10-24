import { pgTable, uuid, text, pgEnum, decimal, timestamp, date, boolean } from 'drizzle-orm/pg-core';
import { builders } from './builders';
import { communities } from './communities';
import { modelPlans } from './model_plans';
import { services } from './services';
import { assignments } from './assignments';
import { fieldTickets } from './field_tickets';
import { invoiceLines } from './invoice_lines';

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
  assignmentId: uuid('assignment_id').references(() => assignments.id),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
