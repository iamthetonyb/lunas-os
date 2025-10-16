"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.services = exports.unitKindEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.unitKindEnum = (0, pg_core_1.pgEnum)('unit_kind', ['PER_JOB', 'PER_SQFT', 'PER_UNIT']);
exports.services = (0, pg_core_1.pgTable)('services', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    code: (0, pg_core_1.text)('code').unique().notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    category: (0, pg_core_1.text)('category'),
    unitKind: (0, exports.unitKindEnum)('unit_kind'),
});
