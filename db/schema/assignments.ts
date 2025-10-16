import { pgTable, uuid, timestamp, pgEnum, text } from 'drizzle-orm/pg-core';
import { jobRequestServices } from './job_request_services';
import { crews } from './crews';
import { dispatchBatches } from './dispatch_batches';

export const assignmentStatusEnum = pgEnum('assignment_status', ['DRAFT', 'SENT', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETE', 'NOT_DONE']);

export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobRequestServiceId: uuid('job_request_service_id').references(() => jobRequestServices.id),
  crewId: uuid('crew_id').references(() => crews.id),
  dispatchBatchId: uuid('dispatch_batch_id').references(() => dispatchBatches.id),
  scheduledStart: timestamp('scheduled_start'),
  scheduledEnd: timestamp('scheduled_end'),
  status: assignmentStatusEnum('status').default('DRAFT'),
  notes: text('notes'),
});
