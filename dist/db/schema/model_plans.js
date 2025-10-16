"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelPlans = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const builders_1 = require("./builders");
exports.modelPlans = (0, pg_core_1.pgTable)('model_plans', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    builderId: (0, pg_core_1.uuid)('builder_id').references(() => builders_1.builders.id),
    code: (0, pg_core_1.text)('code'),
    name: (0, pg_core_1.text)('name').notNull(),
    sqft: (0, pg_core_1.text)('sqft'),
    defaults: (0, pg_core_1.json)('defaults'),
}, (table) => {
    return {
        builderIdCodeUnique: (0, pg_core_1.unique)('builder_id_code_unique').on(table.builderId, table.code),
    };
});
