import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { services } from '@/db/schema';
import { getPgDrizzle } from './db-client';

type CatalogEntry = {
  code: string;
  name: string;
  category: string;
  unit: string;
};

const CATALOG: CatalogEntry[] = [
  { code: 'CLEAN_ROUGH', name: 'Rough Clean', category: 'cleanup', unit: 'unit' },
  { code: 'CLEAN_FINAL', name: 'Final Clean', category: 'cleanup', unit: 'unit' },
  { code: 'CLEAN_DETAIL', name: 'Detail / Punch Clean', category: 'cleanup', unit: 'unit' },
  { code: 'CLEAN_EXTRAS', name: 'Extras / Misc', category: 'cleanup', unit: 'unit' },
  {
    code: 'CLEAN_WINDOWS_INT',
    name: 'Window Cleaning (Interior)',
    category: 'cleanup',
    unit: 'unit',
  },
  {
    code: 'CLEAN_WINDOWS_EXT',
    name: 'Window Cleaning (Exterior)',
    category: 'cleanup',
    unit: 'unit',
  },
  {
    code: 'CLEAN_BATH_TUBS',
    name: 'Tub/Shower Polish & Detail',
    category: 'cleanup',
    unit: 'unit',
  },
  { code: 'CLEAN_APPLIANCES', name: 'Appliance Detail', category: 'cleanup', unit: 'unit' },
  { code: 'CLEAN_TRASH_HAUL', name: 'Trash / Debris Haul-Off', category: 'cleanup', unit: 'unit' },
  {
    code: 'POWER_WASH_DRIVE',
    name: 'Power Wash (Driveway/Garage)',
    category: 'power-wash',
    unit: 'unit',
  },
  {
    code: 'POWER_WASH_EXT',
    name: 'Power Wash (Exterior Siding/Walks)',
    category: 'power-wash',
    unit: 'unit',
  },
  {
    code: 'CLEAN_WINDOWS_ALL',
    name: 'Window Cleaning (In/Out)',
    category: 'cleanup',
    unit: 'unit',
  },
];

const UNIT_INTENT_MATCHERS: Record<string, RegExp> = {
  each: /^(unit|each|ea|per[_\s]?unit)$/i,
  hour: /^(hour|hr|hrs|per[_\s]?hour)$/i,
  sqft: /^(sq\.?\s?ft|sqft|sf|per[_\s]?sqft)$/i,
  lft: /^(lf|lft|linear[\s_-]?foot)$/i,
};

const mapUnit = (intent: string, available: string[]): string => {
  if (!available.length) throw new Error('[seed-services] unit_kind enum has no labels');
  const norm = intent.trim().toLowerCase();
  const tryMatch = (matcher?: RegExp) =>
    matcher && available.find((label) => matcher.test(label));

  if (['each', 'ea', 'unit', 'u'].includes(norm)) {
    return tryMatch(UNIT_INTENT_MATCHERS.each) ?? available[0];
  }

  if (['hour', 'hr', 'hrs'].includes(norm)) {
    return tryMatch(UNIT_INTENT_MATCHERS.hour) ?? available[0];
  }

  if (['sqft', 'sf'].includes(norm)) {
    return tryMatch(UNIT_INTENT_MATCHERS.sqft) ?? available[0];
  }

  if (['lft', 'lf'].includes(norm)) {
    return tryMatch(UNIT_INTENT_MATCHERS.lft) ?? available[0];
  }

  return available[0];
};

async function fetchEnumLabelsForUnitKind(db: ReturnType<typeof getPgDrizzle>['db']) {
  const query = sql`
    SELECT e.enumlabel
    FROM pg_attribute a
    JOIN pg_class c     ON a.attrelid     = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_type t      ON a.atttypid     = t.oid
    JOIN pg_enum e      ON t.oid          = e.enumtypid
    WHERE n.nspname = 'public'
      AND c.relname = 'services'
      AND a.attname = 'unit_kind'
    ORDER BY e.enumsortorder;
  `;
  const result: any = await db.execute(query);
  // postgres-js returns rows directly in the array, not in a .rows property
  const labels = (Array.isArray(result) ? result : result?.rows ?? [])
    .map((row: any) => row.enumlabel)
    .filter(Boolean);
  return labels;
}

async function main() {
  const { db, client } = getPgDrizzle();
  try {
    const enumLabels = await fetchEnumLabelsForUnitKind(db);
    if (!enumLabels.length) {
      throw new Error('[seed-services] could not discover enum labels for services.unit_kind');
    }

    let processed = 0;
    for (const svc of CATALOG) {
      const unitKind = mapUnit(svc.unit, enumLabels);
      await db
        .insert(services)
        .values({
          code: svc.code,
          name: svc.name,
          category: svc.category,
          unitKind: unitKind as typeof services.$inferInsert.unitKind,
        })
        .onConflictDoUpdate({
          target: services.code,
          set: {
            name: svc.name,
            category: svc.category,
            unitKind: unitKind as typeof services.$inferInsert.unitKind,
          },
        });
      processed += 1;
      console.log('[seed-services] upserted', svc.code, '→', unitKind);
    }

    console.log(`[seed-services] ✅ ${processed} services upserted.`);

    const snapshot: any = await db.execute(sql`
      SELECT code, name, category, unit_kind
      FROM public.services
      ORDER BY code;
    `);

    const rows: Array<Record<string, string>> = snapshot?.rows ?? [];
    console.log('[seed-services] current catalog:');
    for (const row of rows) {
      const code = String(row.code ?? '').padEnd(18);
      const name = String(row.name ?? '').padEnd(35);
      const category = String(row.category ?? '').padEnd(12);
      const unitKind = row.unit_kind ?? '';
      console.log(`  ${code} ${name} ${category} ${unitKind}`);
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[seed-services] ❌', err);
  process.exit(1);
});
