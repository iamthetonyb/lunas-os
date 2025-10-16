import { pgTable, text, uuid, boolean } from 'drizzle-orm/pg-core';

export const builders = pgTable('builders', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').unique().notNull(),
  active: boolean('active').default(true),
});
