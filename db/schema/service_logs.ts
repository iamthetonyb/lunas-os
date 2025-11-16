import { pgTable, uuid, date, text, time, numeric, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';

export const serviceLogs = pgTable(
  'service_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    projectName: text('project_name'),
    builder: text('builder'),
    community: text('community'),
    address: text('address'),
    lot: text('lot'),
    unitLot: text('unit_lot'),
    serviceType: text('service_type'),
    category: text('category'),
    status: text('status'),
    timeIn: time('time_in'),
    timeOut: time('time_out'),
    hours: numeric('hours', { precision: 6, scale: 2 }),
    team: text('team').array(),
    extras: text('extras'),
    supervisor: text('supervisor'),
    foreman: text('foreman'),
    crewLeader: text('crew_leader'),
    explainWork: text('explain_work'),
    amount: numeric('amount', { precision: 12, scale: 2 }),
    source: text('source').default('manual').notNull(),
    photos: text('photos').array(),
    externalId: text('external_id'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgDateIdx: index('service_logs_org_date_idx').on(table.orgId, table.date),
    orgExternalIdx: uniqueIndex('service_logs_org_external_idx').on(table.orgId, table.externalId),
  })
);
