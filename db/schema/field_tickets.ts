import { pgTable, uuid, timestamp, pgEnum, json, text } from 'drizzle-orm/pg-core';
import { assignments } from './assignments';
import { users } from './users';

export const ticketStatusEnum = pgEnum('ticket_status', ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);

export const fieldTickets = pgTable('field_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  assignmentId: uuid('assignment_id').references(() => assignments.id).unique(),
  submittedById: uuid('submitted_by_id').references(() => users.id),
  submittedAt: timestamp('submitted_at'),
  status: ticketStatusEnum('status').default('DRAFT'),
  items: json('items'),
  notes: text('notes'),
  customerSig: text('customer_sig'),
  foremanSig: text('foreman_sig'),
  ticketPdfUrl: text('ticket_pdf_url'),
});
