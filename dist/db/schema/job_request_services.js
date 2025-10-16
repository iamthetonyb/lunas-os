"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobRequestServices = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const job_requests_1 = require("./job_requests");
const services_1 = require("./services");
exports.jobRequestServices = (0, pg_core_1.pgTable)('job_request_services', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    jobRequestId: (0, pg_core_1.uuid)('job_request_id').references(() => job_requests_1.jobRequests.id),
    serviceId: (0, pg_core_1.uuid)('service_id').references(() => services_1.services.id),
    requestedData: (0, pg_core_1.json)('requested_data'),
    walkTime: (0, pg_core_1.text)('walk_time'),
});
