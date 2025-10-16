"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crews = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
exports.crews = (0, pg_core_1.pgTable)('crews', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)('name').notNull(),
    foremanId: (0, pg_core_1.uuid)('foreman_id').references(() => users_1.users.id),
    skills: (0, pg_core_1.text)('skills').array(),
    capacityPerDay: (0, pg_core_1.integer)('capacity_per_day'),
});
