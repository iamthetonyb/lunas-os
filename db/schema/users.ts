import { pgTable, text, timestamp, uuid, pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['ADMIN', 'DISPATCHER', 'FOREMAN', 'CREW', 'OFFICE', 'CUSTOMER']);
export const langEnum = pgEnum('preferred_lang', ['EN', 'ES_MX']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  phone: text('phone'),
  name: text('name'),
  role: roleEnum('role').notNull(),
  preferredLang: langEnum('preferred_lang').default('EN'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
