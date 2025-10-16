"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.smsEmailLogs = exports.logKindEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.logKindEnum = (0, pg_core_1.pgEnum)('log_kind', ['sms', 'email']);
exports.smsEmailLogs = (0, pg_core_1.pgTable)('sms_email_logs', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    kind: (0, exports.logKindEnum)('kind'),
    to: (0, pg_core_1.text)('to'),
    body: (0, pg_core_1.text)('body'),
    meta: (0, pg_core_1.json)('meta'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
