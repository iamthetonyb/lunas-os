import 'dotenv/config';
import fg from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';
import Database from 'better-sqlite3';

type Opts = { roots: string[]; minSizeMB: number };

function parseArgs(): Opts {
  const raw = process.argv.join(' ');
  const rootsArg = /--roots=([^\s]+)/.exec(raw)?.[1] ?? process.env.SQLITE_SEARCH_ROOTS ?? '';
  const minSizeMB = Number(/--minSizeMB=([0-9.]+)/.exec(raw)?.[1] ?? '0.05');
  const roots = rootsArg.split(',').map((s) => s.trim()).filter(Boolean);
  return { roots: roots.length ? roots : [process.cwd()], minSizeMB };
}

const TABLES = ['blue_book_entries', 'builders', 'communities', 'services', 'crews', 'model_plans'];

async function findSqlites({ roots, minSizeMB }: Opts) {
  const patterns = roots.flatMap((root) => [
    path.join(root, '**/*.db'),
    path.join(root, '**/*.sqlite'),
    path.join(root, '**/*.sqlite3'),
    path.join(root, '**/lunas.db'),
  ]);

  const entries = await fg(patterns, {
    onlyFiles: true,
    unique: true,
    suppressErrors: true,
    ignore: ['**/node_modules/**', '**/Library/**', '**/.git/**', '**/Caches/**', '**/DerivedData/**'],
    dot: true,
    stats: true,
  });

  const minBytes = minSizeMB * 1024 * 1024;

  const results: Array<{
    path: string;
    sizeMB: number;
    mtime: string;
    counts: Record<string, number>;
    score: number;
  }> = [];

  for (const e of entries) {
    const p = e.path ?? (e as any).absolute ?? '';
    try {
      const st = await fs.stat(p);
      if (st.size < minBytes) continue;

      let db: Database.Database | undefined;
      try {
        db = new Database(p, { readonly: true, fileMustExist: true });
      } catch {
        continue;
      }

      const counts: Record<string, number> = {};
      let score = 0;
      for (const t of TABLES) {
        try {
          const row = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number };
          counts[t] = row?.c ?? 0;
          score += counts[t];
        } catch {}
      }
      db.close();

      if (score > 0) {
        results.push({
          path: p,
          sizeMB: +(st.size / (1024 * 1024)).toFixed(2),
          mtime: new Date(st.mtimeMs).toISOString(),
          counts,
          score,
        });
      }
    } catch {}
  }

  results.sort((a, b) => b.score - a.score || b.sizeMB - a.sizeMB);

  if (!results.length) {
    console.log(`No SQLite files with data found in ${roots.join(', ')} (minSizeMB=${minSizeMB}).`);
    console.log('Try broader search: pnpm db:find:sqlite:all');
    return;
  }

  console.log('\nFound candidate SQLite databases (most rows first):\n');
  for (const r of results) {
    const summary = TABLES.map((t) => `${t}:${r.counts[t] ?? 0}`).join(' ');
    console.log(`• ${r.path}`);
    console.log(`    size=${r.sizeMB}MB  mtime=${r.mtime}  rows(${summary})`);
  }
  console.log('\nTo import one into Postgres:');
  console.log('  pnpm db:copy:sqlite -- --src "<ABSOLUTE_PATH_FROM_LIST>"\n');
}

findSqlites(parseArgs()).catch((err) => {
  console.error('[find-sqlite] ❌', err);
  process.exit(1);
});
