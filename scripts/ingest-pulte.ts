import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import fg from 'fast-glob';
import postgres from 'postgres';
import Papa from 'papaparse';
import { z } from 'zod';

const srcArg = process.argv.find((a) => a.startsWith('--src='))?.split('=')[1];
const sql = (() => {
  const url = process.env.DATABASE_URL!;
  const ssl = /localhost|127\.0\.0\.1/.test(url) ? false : 'require';
  return postgres(url, { ssl, max: 1 });
})();

const Row = z.object({
  builder: z.string().optional(),
  community: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  lot: z.string().optional(),
  modelPlanCode: z.string().optional().or(z.number().transform(String)),
  modelPlanName: z.string().optional(),
  sqft: z.string().optional().or(z.number().transform(String)),
  serviceCode: z.string().optional(),
  serviceName: z.string().optional(),
  category: z.string().optional(),
  unitKind: z.string().optional(),
  status: z.string().optional(),
  amount: z.string().optional().or(z.number().transform(String)),
  checkDate: z.string().optional(),
  startDate: z.string().optional(),
  poNumber: z.string().optional(),
});

type TRow = z.infer<typeof Row>;

async function listFiles(rootOrFile: string) {
  const stat = await fs.stat(rootOrFile);
  if (stat.isFile()) return [rootOrFile];
  const patterns = [path.join(rootOrFile, '**/*.{csv,json}')];
  return fg(patterns, {
    onlyFiles: true,
    unique: true,
    ignore: ['**/node_modules/**', '**/.git/**', '**/.next/**', '**/Library/**'],
  });
}

function parseFile(file: string): TRow[] {
  const text = require('fs').readFileSync(file, 'utf8');
  if (file.toLowerCase().endsWith('.json')) {
    const val = JSON.parse(text);
    if (Array.isArray(val)) return val.map((v) => Row.parse(v));
    if (Array.isArray(val.rows)) return val.rows.map((v: any) => Row.parse(v));
    return [];
  }
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  return (parsed.data as any[]).map((r) => {
    const m: any = {};
    for (const [k, v] of Object.entries(r)) m[String(k).trim()] = typeof v === 'string' ? v.trim() : v;
    return Row.parse({
      builder: m.builder || m.Builder || m.builder_name,
      community: m.community || m.Community || m.community_name,
      city: m.city || m.City,
      state: m.state || m.State,
      lot: m.lot || m.Lot,
      modelPlanCode: m.modelPlanCode || m.model_code || m.Model || m['Model Code'],
      modelPlanName: m.modelPlanName || m.model || m['Model Name'],
      sqft: m.sqft || m.SqFt || m['Square Feet'],
      serviceCode: m.serviceCode || m.code || m['Service Code'],
      serviceName: m.serviceName || m.service || m['Service Name'],
      category: m.category || m['Category'],
      unitKind: m.unitKind || m['Unit'] || m['Unit Kind'],
      status: m.status || m['Status'],
      amount: m.amount || m['Amount'],
      checkDate: m.checkDate || m['Check Date'],
      startDate: m.startDate || m['Start Date'],
      poNumber: m.poNumber || m['PO'] || m['PO Number'],
    });
  });
}

async function allEnumValues(enumTypename: string): Promise<string[]> {
  const rows = await sql`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = ${enumTypename} ORDER BY e.enumsortorder`;
  return rows.map((r: any) => r.enumlabel as string);
}

function normUnitKind(inVal: string | undefined, allowed: string[]): string | undefined {
  if (!inVal) return allowed[0];
  const v = inVal.toLowerCase().trim();
  const map: Record<string, string> = {
    ea: 'each',
    each: 'each',
    unit: 'unit',
    units: 'unit',
    hr: 'hour',
    hours: 'hour',
    h: 'hour',
    lf: 'lf',
    sf: 'sf',
    sy: 'sy',
    yd: 'yd',
    cy: 'cy',
  };
  const candidate = map[v] ?? v;
  const exact = allowed.find((a) => a === candidate);
  if (exact) return exact;
  const contains = allowed.find((a) => a.includes(candidate) || candidate.includes(a));
  return contains ?? allowed[0];
}

async function upsertId(table: string, by: Record<string, any>, insert: Record<string, any>) {
  const where = Object.keys(by)
    .map((k, i) => `${k} = $${i + 1}`)
    .join(' AND ');
  const sel = await sql.unsafe(`SELECT id FROM ${table} WHERE ${where} LIMIT 1`, Object.values(by));
  if (sel.length) return sel[0].id as string;
  const cols = Object.keys(insert);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
  const ins = await sql.unsafe(
    `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders}) RETURNING id`,
    Object.values(insert),
  );
  return ins[0].id as string;
}

async function main() {
  if (!srcArg) {
    console.log('Usage: pnpm db:ingest:pulte -- --src "/absolute/path/to/file-or-dir"');
    process.exit(1);
  }
  const files = await listFiles(srcArg);
  if (!files.length) {
    console.log('No files found at --src.');
    process.exit(1);
  }

  const rows: TRow[] = files
    .flatMap((f) => {
      try {
        return parseFile(f);
      } catch {
        return [];
      }
    })
    .filter(Boolean);

  if (!rows.length) {
    console.log('No recognizable rows in the provided files.');
    process.exit(0);
  }
  console.log(`[ingest] ${rows.length} rows from ${files.length} file(s)`);

  const allowedUnits = await allEnumValues('unit_kind');

  await sql.begin(async (trx) => {
    for (const r of rows) {
      const builderName = (r.builder ?? '').trim();
      if (!builderName) continue;
      const builderId = await upsertId('builders', { name: builderName }, { name: builderName, active: true });

      let communityId: string | undefined;
      const commName = (r.community ?? '').trim();
      if (commName) {
        communityId = await upsertId(
          'communities',
          { name: commName, builder_id: builderId },
          { name: commName, builder_id: builderId, city: r.city || null, state: r.state || null, active: true },
        );
      }

      let modelPlanId: string | undefined;
      const mpCode = (r.modelPlanCode ?? '').trim();
      if (mpCode) {
        modelPlanId = await upsertId(
          'model_plans',
          { code: mpCode, builder_id: builderId },
          { code: mpCode, name: (r.modelPlanName || mpCode).trim() || mpCode, builder_id: builderId, sqft: r.sqft ? Number(r.sqft) : null, defaults: null },
        );
      }

      let serviceId: string | undefined;
      const svcCode = (r.serviceCode ?? '').trim();
      if (svcCode) {
        const unitKind = normUnitKind(r.unitKind, allowedUnits);
        serviceId = await upsertId(
          'services',
          { code: svcCode },
          {
            code: svcCode,
            name: (r.serviceName || svcCode).trim() || svcCode,
            category: (r.category || 'general').toLowerCase(),
            unit_kind: unitKind ?? allowedUnits[0],
          },
        );
      }

      if (communityId && modelPlanId && serviceId) {
        const amount = r.amount ? Number(String(r.amount).replace(/[,$]/g, '')) : null;
        const startDate = r.startDate ? new Date(r.startDate) : null;
        const checkDate = r.checkDate ? new Date(r.checkDate) : null;
        const status = (r.status || 'new').toLowerCase();

        await trx`
          INSERT INTO blue_book_entries (
            builder_id, community_id, lot, model_plan_id, service_id,
            po_number, status, amount, check_date, start_date,
            created_at, updated_at
          ) VALUES (
            ${builderId}, ${communityId}, ${r.lot || null}, ${modelPlanId}, ${serviceId},
            ${r.poNumber || null}, ${status}, ${amount}, ${checkDate}, ${startDate},
            now(), now()
          )
          ON CONFLICT DO NOTHING
        `;
      }
    }
  });

  await sql.end({ timeout: 5 });
  console.log('[ingest] done.');
}

main().catch(async (e) => {
  console.error('[ingest] ❌', e);
  try {
    await sql.end({ timeout: 5 });
  } catch {}
  process.exit(1);
});
