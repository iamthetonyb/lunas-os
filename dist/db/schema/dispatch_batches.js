"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchBatches = exports.dispatchStatusEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
exports.dispatchStatusEnum = (0, pg_core_1.pgEnum)('dispatch_status', ['DRAFT', 'SENT']);
exports.dispatchBatches = (0, pg_core_1.pgTable)('dispatch_batches', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    serviceDate: (0, pg_core_1.date)('service_date'),
    status: (0, exports.dispatchStatusEnum)('status').default('DRAFT'),
    notes: (0, pg_core_1.text)('notes'),
    createdById: (0, pg_core_1.uuid)('created_by_id').references(() => users_1.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
