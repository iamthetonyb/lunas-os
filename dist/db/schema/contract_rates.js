"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contractRates = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const builders_1 = require("./builders");
const services_1 = require("./services");
const model_plans_1 = require("./model_plans");
exports.contractRates = (0, pg_core_1.pgTable)('contract_rates', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    builderId: (0, pg_core_1.uuid)('builder_id').references(() => builders_1.builders.id),
    serviceId: (0, pg_core_1.uuid)('service_id').references(() => services_1.services.id),
    modelPlanId: (0, pg_core_1.uuid)('model_plan_id').references(() => model_plans_1.modelPlans.id),
    basis: (0, pg_core_1.text)('basis'),
    rate: (0, pg_core_1.decimal)('rate'),
    unitLabel: (0, pg_core_1.text)('unit_label'),
    effectiveOn: (0, pg_core_1.date)('effective_on'),
    expiresOn: (0, pg_core_1.date)('expires_on'),
});
