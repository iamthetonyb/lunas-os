import { pgTable, uuid, json, text } from 'drizzle-orm/pg-core';
import { jobRequests } from './job_requests';
import { services } from './services';

export const jobRequestServices = pgTable('job_request_services', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobRequestId: uuid('job_request_id').references(() => jobRequests.id),
  serviceId: uuid('service_id').references(() => services.id),
  requestedData: json('requested_data'),
  walkTime: text('walk_time'),
});
