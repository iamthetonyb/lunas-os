import { pgTable, text, uuid, pgEnum } from 'drizzle-orm/pg-core';

export const unitKindEnum = pgEnum('unit_kind', ['PER_JOB', 'PER_SQFT', 'PER_UNIT']);

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  category: text('category'),
  unitKind: unitKindEnum('unit_kind'),
});
