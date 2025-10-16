import { pgTable, text, uuid, boolean, unique } from 'drizzle-orm/pg-core';
import { builders } from './builders';

export const communities = pgTable('communities', {
  id: uuid('id').primaryKey().defaultRandom(),
  builderId: uuid('builder_id').references(() => builders.id),
  name: text('name').notNull(),
  city: text('city'),
  state: text('state'),
  lat: text('lat'),
  lng: text('lng'),
  active: boolean('active').default(true),
}, (table) => {
  return {
    builderIdNameUnique: unique('builder_id_name_unique').on(table.builderId, table.name),
  };
});
