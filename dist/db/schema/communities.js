"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.communities = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const builders_1 = require("./builders");
exports.communities = (0, pg_core_1.pgTable)('communities', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    builderId: (0, pg_core_1.uuid)('builder_id').references(() => builders_1.builders.id),
    name: (0, pg_core_1.text)('name').notNull(),
    city: (0, pg_core_1.text)('city'),
    state: (0, pg_core_1.text)('state'),
    lat: (0, pg_core_1.text)('lat'),
    lng: (0, pg_core_1.text)('lng'),
    active: (0, pg_core_1.boolean)('active').default(true),
}, (table) => {
    return {
        builderIdNameUnique: (0, pg_core_1.unique)('builder_id_name_unique').on(table.builderId, table.name),
    };
});
