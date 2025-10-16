"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignments = exports.assignmentStatusEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const job_request_services_1 = require("./job_request_services");
const crews_1 = require("./crews");
const dispatch_batches_1 = require("./dispatch_batches");
exports.assignmentStatusEnum = (0, pg_core_1.pgEnum)('assignment_status', ['DRAFT', 'SENT', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETE', 'NOT_DONE']);
exports.assignments = (0, pg_core_1.pgTable)('assignments', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    jobRequestServiceId: (0, pg_core_1.uuid)('job_request_service_id').references(() => job_request_services_1.jobRequestServices.id),
    crewId: (0, pg_core_1.uuid)('crew_id').references(() => crews_1.crews.id),
    dispatchBatchId: (0, pg_core_1.uuid)('dispatch_batch_id').references(() => dispatch_batches_1.dispatchBatches.id),
    scheduledStart: (0, pg_core_1.timestamp)('scheduled_start'),
    scheduledEnd: (0, pg_core_1.timestamp)('scheduled_end'),
    status: (0, exports.assignmentStatusEnum)('status').default('DRAFT'),
    notes: (0, pg_core_1.text)('notes'),
});
