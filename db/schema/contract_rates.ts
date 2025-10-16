import { pgTable, uuid, decimal, text, date } from 'drizzle-orm/pg-core';
import { builders } from './builders';
import { services } from './services';
import { modelPlans } from './model_plans';

export const contractRates = pgTable('contract_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  builderId: uuid('builder_id').references(() => builders.id),
  serviceId: uuid('service_id').references(() => services.id),
  modelPlanId: uuid('model_plan_id').references(() => modelPlans.id),
  basis: text('basis'),
  rate: decimal('rate'),
  unitLabel: text('unit_label'),
  effectiveOn: date('effective_on'),
  expiresOn: date('expires_on'),
});
