"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.builders = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.builders = (0, pg_core_1.pgTable)('builders', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)('name').unique().notNull(),
    active: (0, pg_core_1.boolean)('active').default(true),
});
