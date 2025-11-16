#!/usr/bin/env node
/**
 * ingest-pulte-live.ts
 * Idempotent ingestion of Pulte harvest data into PostgreSQL
 * Calls harvest-pulte.ts and upserts to DB with proper enum handling
 */

import 'dotenv/config';
import dayjs from 'dayjs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { harvestPulteExcel, type HarvestResult } from './harvest-pulte-excel';
import { getPgDrizzle } from './db-client';
import { blueBookEntries, builders, communities, modelPlans, services } from '../db/schema';
import { and, eq, sql } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

type IngestOptions = {
  start: string;
  end: string;
  communities?: string[];
  headless: boolean;
  concurrency: number;
};

type IngestStats = {
  scraped: number;
  builders: { inserted: number; existing: number };
  communities: { inserted: number; existing: number };
  modelPlans: { inserted: number; existing: number };
  services: { inserted: number; existing: number };
  blueBookEntries: { inserted: number; updated: number; skipped: number };
  dateRange: { first: string | null; last: string | null };
  communitiesMatched: string[];
};

// ============================================================================
// Enum label discovery
// ============================================================================

async function fetchUnitKindEnumLabels(db: ReturnType<typeof getPgDrizzle>['db']): Promise<string[]> {
  const query = sql`
    SELECT e.enumlabel
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_type t ON a.atttypid = t.oid
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE n.nspname = 'public'
      AND c.relname = 'services'
      AND a.attname = 'unit_kind'
    ORDER BY e.enumsortorder;
  `;
  const result: any = await db.execute(query);
  const labels = (Array.isArray(result) ? result : result?.rows ?? [])
    .map((row: any) => row.enumlabel)
    .filter(Boolean);
  return labels;
}

function mapUnitKind(raw: string | null | undefined, enumLabels: string[]): string {
  if (!raw || enumLabels.length === 0) return enumLabels[0] || 'PER_JOB';
  
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Map common variations
  if (/each|ea|unit|u/.test(normalized)) {
    const match = enumLabels.find((label) => /unit|each|ea/i.test(label));
    if (match) return match;
  }
  
  if (/hour|hr|hrs/.test(normalized)) {
    const match = enumLabels.find((label) => /hour|hr/i.test(label));
    if (match) return match;
  }
  
  if (/sqft|sf|square/.test(normalized)) {
    const match = enumLabels.find((label) => /sqft|sf|square/i.test(label));
    if (match) return match;
  }
  
  if (/job|perJob/.test(normalized)) {
    const match = enumLabels.find((label) => /job/i.test(label));
    if (match) return match;
  }
  
  // Default to first enum label
  return enumLabels[0];
}

// ============================================================================
// Parsing helpers
// ============================================================================

function splitJobNumber(jobNumber: string | null | undefined) {
  if (!jobNumber) return { communityCode: null, lot: null };
  const segments = jobNumber.split('-').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) return { communityCode: null, lot: null };
  const [communityCode, lot] = segments;
  return {
    communityCode: communityCode || null,
    lot: lot || null,
  };
}

function parseAccountCategory(raw: string | null | undefined) {
  if (!raw) return { code: null, name: null };
  const match = raw.match(/^(\d+)\s*-\s*(.*?)(?:\s*-\s*\d+)?$/);
  if (match) {
    return {
      code: match[1]?.trim() || null,
      name: match[2]?.trim() || null,
    };
  }
  return {
    code: null,
    name: raw.trim() || null,
  };
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value.trim().split(' ')[0];
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  const month = Number(mm);
  const day = Number(dd);
  const year = Number(yyyy);
  if (Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(year)) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ============================================================================
// Ingest function
// ============================================================================

export async function ingestPulteLive(options: IngestOptions): Promise<IngestStats> {
  console.log('\n🚀 Starting Pulte harvest and ingest...\n');
  
  // Convert YYYY-MM-DD to MM/DD/YYYY format for Pulte
  const startDate = dayjs(options.start).format('MM/DD/YYYY');
  const endDate = dayjs(options.end).format('MM/DD/YYYY');
  
  // Harvest data using Excel harvester
  const harvestResult = await harvestPulteExcel({
    start: startDate,
    end: endDate,
    headless: options.headless,
  });
  
  console.log(`\n📥 Ingesting ${harvestResult.items.length} items into database...\n`);
  
  const { db, client } = getPgDrizzle();
  
  const stats: IngestStats = {
    scraped: harvestResult.items.length,
    builders: { inserted: 0, existing: 0 },
    communities: { inserted: 0, existing: 0 },
    modelPlans: { inserted: 0, existing: 0 },
    services: { inserted: 0, existing: 0 },
    blueBookEntries: { inserted: 0, updated: 0, skipped: 0 },
    dateRange: { first: null, last: null },
    communitiesMatched: [],
  };
  
  try {
    // Get unit_kind enum labels
    const unitKindLabels = await fetchUnitKindEnumLabels(db);
    console.log(`  Unit kind enum labels: ${unitKindLabels.join(', ')}`);
    
    // Get or create Pulte builder
    let builder = await db.query.builders.findFirst({
      where: eq(builders.name, 'Pulte'),
    });
    
    if (!builder) {
      const [newBuilder] = await db.insert(builders).values({
        name: 'Pulte',
      }).returning();
      builder = newBuilder;
      stats.builders.inserted++;
      console.log('  ✓ Created Pulte builder');
    } else {
      stats.builders.existing++;
    }
    
    const builderId = builder.id;
    
    // Build caches
    const communityCache = new Map<string, string>();
    const serviceCache = new Map<string, string>();
    const modelPlanCache = new Map<string, string | null>();
    
    // Build job map from harvested items (Excel harvester embeds this data)
    const jobMap = new Map<string, { 
      name: string;
      planName: string | null;
      scarStartDate: string | null;
    }>();
    
    for (const item of harvestResult.items) {
      if (!item.communityCode) continue;
      if (!jobMap.has(item.communityCode)) {
        jobMap.set(item.communityCode, {
          name: item.communityName || item.communityCode,
          planName: item.planName || null,
          scarStartDate: item.scarStartDate || null,
        });
      }
    }
    
    // Pre-populate communities from job map
    if (builderId && jobMap.size) {
      for (const [code, meta] of jobMap.entries()) {
        await getCommunityId(code, meta.name);
      }
    }
    
    // Helper: get or create community
    async function getCommunityId(code: string | null, friendlyName?: string | null) {
      if (!builderId || !code) return null;
      if (communityCache.has(code)) {
        return communityCache.get(code)!;
      }
      
      const targetName = friendlyName || code;
      
      const existing = await db.query.communities.findFirst({
        where: and(eq(communities.builderId, builderId), eq(communities.name, targetName)),
      });
      
      if (existing) {
        communityCache.set(code, existing.id);
        stats.communities.existing++;
        return existing.id;
      }
      
      // Check if community exists by code name and needs friendly name update
      if (friendlyName && friendlyName !== code) {
        const existingByCode = await db.query.communities.findFirst({
          where: and(eq(communities.builderId, builderId), eq(communities.name, code)),
        });
        
        if (existingByCode) {
          await db.update(communities)
            .set({ name: friendlyName })
            .where(eq(communities.id, existingByCode.id));
          communityCache.set(code, existingByCode.id);
          stats.communities.existing++;
          return existingByCode.id;
        }
      }
      
      const [row] = await db.insert(communities).values({
        builderId,
        name: targetName,
      }).returning();
      
      communityCache.set(code, row.id);
      stats.communities.inserted++;
      if (!stats.communitiesMatched.includes(targetName)) {
        stats.communitiesMatched.push(targetName);
      }
      return row.id;
    }
    
    // Helper: get or create service
    async function getServiceId(code: string | null, name: string | null) {
      if (!code || !name) return null;
      if (serviceCache.has(code)) {
        return serviceCache.get(code)!;
      }
      
      const existing = await db.query.services.findFirst({
        where: eq(services.code, code),
      });
      
      if (existing) {
        if (existing.name !== name) {
          await db.update(services).set({ name }).where(eq(services.id, existing.id));
        }
        serviceCache.set(code, existing.id);
        stats.services.existing++;
        return existing.id;
      }
      
      const unitKind = mapUnitKind('job', unitKindLabels);
      
      const [row] = await db.insert(services).values({
        code,
        name,
        unitKind: unitKind as any,
      }).returning();
      
      serviceCache.set(code, row.id);
      stats.services.inserted++;
      return row.id;
    }
    
    // Helper: get or create model plan
    async function getModelPlanId(planCode: string | null, planName: string | null) {
      if (!builderId || !planCode) return null;
      const key = planCode.trim();
      if (!key) return null;
      
      if (modelPlanCache.has(key)) {
        return modelPlanCache.get(key) ?? null;
      }
      
      let existing = await db.query.modelPlans.findFirst({
        where: and(eq(modelPlans.builderId, builderId), eq(modelPlans.code, key)),
      });
      
      // If not found by code and we have a name, try creating it
      if (!existing && planName) {
        const [newPlan] = await db.insert(modelPlans).values({
          builderId,
          code: key,
          name: planName,
        }).returning();
        existing = newPlan;
        stats.modelPlans.inserted++;
        console.log(`  ✓ Created model plan: ${planName} (${key})`);
      }
      
      const value = existing?.id ?? null;
      modelPlanCache.set(key, value);
      if (existing && !stats.modelPlans.inserted) {
        stats.modelPlans.existing++;
      }
      return value;
    }
    
    // Process items in batches
    const BATCH_SIZE = 250;
    let firstCheckDate: string | null = null;
    let lastCheckDate: string | null = null;
    
    for (let i = 0; i < harvestResult.items.length; i += BATCH_SIZE) {
      const batch = harvestResult.items.slice(i, i + BATCH_SIZE);
      console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(harvestResult.items.length / BATCH_SIZE)}...`);
      
      for (const item of batch) {
        const jobNumberRaw = item.jobNumber?.trim() || null;
        const invoiceNumber = item.invoiceNumber?.trim();
        
        if (!invoiceNumber) {
          stats.blueBookEntries.skipped++;
          continue;
        }
        
        const communityCode = item.communityCode || null;
        const lot = item.lot || null;
        const accountCategory = parseAccountCategory(item.accountCategory);
        const jobMeta = communityCode ? jobMap.get(communityCode) : null;
        
        // Use SCAR start date from item (from Jobs tab), not invoice date
        const startDateValue =
          parseDate(item.scarStartDate) ?? 
          parseDate(jobMeta?.scarStartDate) ?? 
          parseDate(item.startDate);
        const checkDateValue = parseDate(item.checkDate);
        
        // Track date range
        if (checkDateValue) {
          if (!firstCheckDate || checkDateValue < firstCheckDate) {
            firstCheckDate = checkDateValue;
          }
          if (!lastCheckDate || checkDateValue > lastCheckDate) {
            lastCheckDate = checkDateValue;
          }
        }
        
        const communityId = await getCommunityId(
          communityCode,
          item.communityName || jobMeta?.name || communityCode
        );
        const serviceId = await getServiceId(accountCategory.code, accountCategory.name);
        const modelPlanId = await getModelPlanId(
          item.planNumber || communityCode,
          item.planName || jobMeta?.planName
        );
        
        // Check for existing entry
        let existing = null;
        const candidateLots = [lot, jobNumberRaw].filter(Boolean) as string[];
        for (const candidate of candidateLots.length ? candidateLots : [null]) {
          const whereClauses = [
            eq(blueBookEntries.poNumber, invoiceNumber),
            ...(candidate ? [eq(blueBookEntries.lot, candidate)] : []),
          ];
          
          existing = await db.query.blueBookEntries.findFirst({
            where: whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses),
          });
          
          if (existing) break;
        }
        
        const amountString = Number.isFinite(item.lineAmount)
          ? item.lineAmount.toFixed(2)
          : '0.00';
        
        const status = item.completedDate ? 'COMPLETE' : 'PENDING';
        
        const values = {
          lot: lot ?? jobNumberRaw,
          poNumber: invoiceNumber,
          status: status as any,
          amount: amountString,
          updatedAt: new Date(),
          accountCategoryCode: accountCategory.code,
          accountCategoryName: accountCategory.name,
          startDate: startDateValue,
          checkNumber: item.checkNumber?.trim() || null,
          checkDate: checkDateValue,
          checkTotal: Number.isFinite(item.checkTotal) ? item.checkTotal.toFixed(2) : null,
          isAch: !!item.isACH,
          source: 'scraped' as const,
          ...(communityId ? { communityId } : {}),
          ...(serviceId ? { serviceId } : {}),
          ...(builderId ? { builderId } : {}),
          ...(modelPlanId ? { modelPlanId } : {}),
        };
        
        if (existing) {
          await db
            .update(blueBookEntries)
            .set(values)
            .where(eq(blueBookEntries.id, existing.id));
          stats.blueBookEntries.updated++;
        } else {
          await db.insert(blueBookEntries).values(values);
          stats.blueBookEntries.inserted++;
        }
      }
    }
    
    stats.dateRange.first = firstCheckDate;
    stats.dateRange.last = lastCheckDate;
    
    console.log('\n✅ Ingest complete!\n');
    return stats;
  } finally {
    await client.end();
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('start', {
      type: 'string',
      description: 'Start date (YYYY-MM-DD)',
      default: dayjs().subtract(90, 'day').format('YYYY-MM-DD'),
    })
    .option('end', {
      type: 'string',
      description: 'End date (YYYY-MM-DD)',
      default: dayjs().format('YYYY-MM-DD'),
    })
    .option('communities', {
      type: 'string',
      description: 'Comma-separated list of community names to filter (case-insensitive)',
    })
    .option('headless', {
      type: 'boolean',
      description: 'Run browser in headless mode',
      default: true,
    })
    .option('concurrency', {
      type: 'number',
      description: 'Concurrency level (for future multi-tab support)',
      default: 4,
    })
    .help()
    .argv;
  
  const communitiesList = argv.communities
    ? argv.communities.split(',').map((c) => c.trim()).filter(Boolean)
    : undefined;
  
  const stats = await ingestPulteLive({
    start: argv.start,
    end: argv.end,
    communities: communitiesList,
    headless: argv.headless,
    concurrency: argv.concurrency,
  });
  
  // Print summary
  console.log('📊 Ingest Summary:');
  console.log('==================');
  console.log(`Scraped:              ${stats.scraped} line items`);
  console.log(`Date range:           ${stats.dateRange.first || 'N/A'} → ${stats.dateRange.last || 'N/A'}`);
  console.log(`Communities matched:  ${stats.communitiesMatched.join(', ') || 'N/A'}`);
  console.log('');
  console.log('Builders:');
  console.log(`  Inserted:  ${stats.builders.inserted}`);
  console.log(`  Existing:  ${stats.builders.existing}`);
  console.log('');
  console.log('Communities:');
  console.log(`  Inserted:  ${stats.communities.inserted}`);
  console.log(`  Existing:  ${stats.communities.existing}`);
  console.log('');
  console.log('Model Plans:');
  console.log(`  Inserted:  ${stats.modelPlans.inserted}`);
  console.log(`  Existing:  ${stats.modelPlans.existing}`);
  console.log('');
  console.log('Services:');
  console.log(`  Inserted:  ${stats.services.inserted}`);
  console.log(`  Existing:  ${stats.services.existing}`);
  console.log('');
  console.log('Blue Book Entries:');
  console.log(`  Inserted:  ${stats.blueBookEntries.inserted}`);
  console.log(`  Updated:   ${stats.blueBookEntries.updated}`);
  console.log(`  Skipped:   ${stats.blueBookEntries.skipped}`);
  console.log('');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Ingest failed:', error);
    process.exit(1);
  });
}
