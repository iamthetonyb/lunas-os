import { pgTable, uuid, pgEnum, text, json, timestamp } from 'drizzle-orm/pg-core';

export const logKindEnum = pgEnum('log_kind', ['sms', 'email']);

export const smsEmailLogs = pgTable('sms_email_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: logKindEnum('kind'),
  to: text('to'),
  body: text('body'),
  meta: json('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
