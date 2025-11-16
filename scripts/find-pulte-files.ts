import 'dotenv/config';
import fg from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';

type Opts = { roots: string[]; minSizeKB: number };

function parseArgs(): Opts {
  const raw = process.argv.join(' ');
  const rootsArg = /--roots=([^\s]+)/.exec(raw)?.[1] ?? '';
  const minSizeKB = Number(/--minSizeKB=([0-9.]+)/.exec(raw)?.[1] ?? '10');
  const roots = rootsArg.split(',').map((s) => s.trim()).filter(Boolean);
  return { roots: roots.length ? roots : [process.cwd()], minSizeKB };
}

const NAME_HINTS = ['pulte', 'bluebook', 'blue_book', 'schedule', 'export', 'bb'];

async function main() {
  const { roots, minSizeKB } = parseArgs();
  const patterns = roots.flatMap((r) => [
    path.join(r, '**/*.json'),
    path.join(r, '**/*.csv'),
  ]);

  const files = await fg(patterns, {
    onlyFiles: true,
    unique: true,
    suppressErrors: true,
    ignore: ['**/node_modules/**', '**/Library/**', '**/.git/**', '**/Caches/**', '**/DerivedData/**', '**/.next/**'],
    dot: true,
    stats: true,
  });

  const minBytes = minSizeKB * 1024;
  const candidates: { file: string; sizeKB: number; score: number }[] = [];

  for (const f of files) {
    const p = f.path ?? (f as any).absolute ?? f;
    try {
      const st = await fs.stat(p);
      if (st.size < minBytes) continue;
      const base = path.basename(p).toLowerCase();
      const score = NAME_HINTS.reduce((n, hint) => n + (base.includes(hint) ? 1 : 0), 0);
      if (!score) continue;
      candidates.push({ file: p, sizeKB: +(st.size / 1024).toFixed(1), score });
    } catch {}
  }

  if (!candidates.length) {
    console.log('No likely Pulte exports found. Try broader roots or check external drives.');
    return;
  }

  candidates.sort((a, b) => b.score - a.score || b.sizeKB - a.sizeKB);
  console.log('\nLikely Pulte/BlueBook export files:\n');
  for (const c of candidates) console.log(`• ${c.file}  (${c.sizeKB} KB)`);
  console.log('\nTo import: pnpm db:ingest:pulte -- --src "ABSOLUTE/PATH"\n');
}

main().catch((e) => {
  console.error('[find-pulte-files] ❌', e);
  process.exit(1);
});
