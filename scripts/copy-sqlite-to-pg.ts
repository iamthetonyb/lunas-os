import 'dotenv/config';
import postgres from 'postgres';
import Database from 'better-sqlite3';

async function main() {
  const src = process.argv.find((a) => a.startsWith('--src='))?.split('=')[1] || process.env.SRC_SQLITE;
  if (!src) throw new Error('Usage: pnpm db:copy:sqlite -- --src="/absolute/path/to/old.db"');

  console.log('[copy] SRC =', src);
  const sqlite = new Database(src, { readonly: true, fileMustExist: true });

  const pgUrl = process.env.DATABASE_URL!;
  const ssl = /localhost|127\.0\.0\.1/.test(pgUrl) ? false : 'require';
  const sql = postgres(pgUrl, { ssl });
  const tx = sql.begin;

  const tables = [
    { name: 'builders', cols: ['id', 'name', 'active'] },
    { name: 'communities', cols: ['id', 'builder_id', 'name', 'city', 'state', 'lat', 'lng', 'active'] },
    { name: 'model_plans', cols: ['id', 'builder_id', 'code', 'name', 'sqft', 'defaults'] },
    { name: 'services', cols: ['id', 'code', 'name', 'category', 'unit_kind'] },
    {
      name: 'blue_book_entries',
      cols: [
        'id',
        'builder_id',
        'community_id',
        'lot',
        'model_plan_id',
        'service_id',
        'po_number',
        'status',
        'assignment_id',
        'ticket_id',
        'invoice_line_id',
        'amount',
        'check_number',
        'check_date',
        'check_total',
        'is_ach',
        'account_category_code',
        'account_category_name',
        'start_date',
        'created_at',
        'updated_at',
      ],
    },
  ];

  await tx(async (trx) => {
    await trx`TRUNCATE TABLE blue_book_entries RESTART IDENTITY CASCADE`;
    await trx`TRUNCATE TABLE model_plans, communities, builders, services RESTART IDENTITY CASCADE`;

    for (const t of tables) {
      const placeholders = t.cols.map(() => trx`?`);
      const insert = trx.unsafe(
        `INSERT INTO ${t.name} (${t.cols.join(',')}) VALUES (${placeholders
          .map(String)
          .join(',')}) ON CONFLICT DO NOTHING`,
      );

      const rows = sqlite.prepare(`SELECT ${t.cols.join(',')} FROM ${t.name}`).iterate();
      let n = 0;
      for (const r of rows as any) {
        const vals = t.cols.map((c) => (r as any)[c] ?? null);
        await insert(vals);
        n++;
      }
      console.log(`[copy] ${t.name}: ${n} rows`);
    }
  });

  await sql.end({ timeout: 5 });
  sqlite.close();
  console.log('[copy] done.');
}

main().catch((e) => {
  console.error('[copy] ❌', e);
  process.exit(1);
});
