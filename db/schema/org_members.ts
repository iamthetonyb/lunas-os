import { pgEnum, pgTable, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';

export const orgMemberRoleEnum = pgEnum('org_role', ['admin', 'backoffice', 'contractor']);

export const orgMembers = pgTable(
  'org_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgMemberRoleEnum('role').notNull().default('contractor'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orgMemberUnique: uniqueIndex('org_members_org_user_key').on(table.orgId, table.userId),
  })
);
