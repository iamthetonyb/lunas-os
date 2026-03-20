#!/usr/bin/env tsx
/**
 * Fix script: Seed crew members into Convex and link unlinked communities to Pulte builder.
 * Run: pnpm tsx scripts/fix-crews-and-communities.ts
 */
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error('Set NEXT_PUBLIC_CONVEX_URL in .env.local');
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);

// Full crew list (from actual operations)
const CREW_NAMES = [
  'Adriana', 'Alan', 'Alejandro', 'Alfonso', 'Anahi', 'Antonio M',
  'Arnulfo', 'Bicho', 'Blanca', 'Carmen', 'Chayo', 'Conchita',
  'Efren', 'Fernando', 'Francisco', 'Guillermo', 'Ignacio', 'Johnny',
  'Jose V', 'Kimberley', 'Letty', 'Luis D', 'Lupe', 'Lupe P',
  'Paco L', 'Paco M', 'Pancho', 'Ramon M', 'Raudel', 'Ricardo',
  'Rogelio', 'Sergio C', 'Sergio E', 'Susana', 'Yadira',
];

async function main() {
  // 1. Seed crew members
  console.log('Seeding crew members...');
  let created = 0;
  let existed = 0;
  for (const name of CREW_NAMES) {
    const result = await convex.mutation(api.seedHelpers.upsertCrew, { name });
    if (result.existed) {
      existed++;
    } else {
      created++;
      console.log(`  Created: ${name}`);
    }
  }
  console.log(`Crews: ${created} created, ${existed} already existed\n`);

  // 2. Link unlinked communities to Pulte
  console.log('Linking unlinked communities to Pulte...');
  const result = await convex.mutation(api.seedHelpers.linkCommunitiesToBuilder, {
    builderName: 'Pulte',
  });
  if ('error' in result) {
    console.error(`  Error: ${result.error}`);
  } else {
    console.log(`  Updated ${result.updated} communities → Pulte (${result.builderId})`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
