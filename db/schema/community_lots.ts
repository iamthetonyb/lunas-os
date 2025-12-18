import { pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core';
import { communities } from './communities';

/**
 * Stores lot data scraped from Pulte portal
 * Job numbers like "8770-00102" map to lot "00102" in community 8770
 */
export const communityLots = pgTable('community_lots', {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id').references(() => communities.id),
    jobNumber: text('job_number').notNull(), // e.g., "8770-00102"
    lotNumber: text('lot_number').notNull(), // e.g., "00102"
    address: text('address'),
    model: text('model'),
    status: text('status').default('active'),
    scrapedAt: timestamp('scraped_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
