import { pgTable, text, uuid, integer } from 'drizzle-orm/pg-core';
import { users } from './users';

export const crews = pgTable('crews', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  foremanId: uuid('foreman_id').references(() => users.id),
  skills: text('skills').array(),
  capacityPerDay: integer('capacity_per_day'),
});
