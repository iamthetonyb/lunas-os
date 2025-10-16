import { pgTable, text, uuid, json, unique } from 'drizzle-orm/pg-core';
import { builders } from './builders';

export const modelPlans = pgTable('model_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  builderId: uuid('builder_id').references(() => builders.id),
  code: text('code'),
  name: text('name').notNull(),
  sqft: text('sqft'),
  defaults: json('defaults'),
}, (table) => {
  return {
    builderIdCodeUnique: unique('builder_id_code_unique').on(table.builderId, table.code),
  };
});
