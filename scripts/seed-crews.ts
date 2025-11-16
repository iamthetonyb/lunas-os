import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { getPgDrizzle } from './db-client';
import { users, crews } from '@/db/schema';

const CREWS = [
  { name: 'Anahi Crew', foremanEmail: 'anahi@lunas.local', skills: ['cleanup', 'frame'], capacityPerDay: 4 },
  { name: 'Chayo Crew', foremanEmail: 'chayo@lunas.local', skills: ['tubs', 'windows'], capacityPerDay: 3 },
  { name: 'Blanca Crew', foremanEmail: 'blanca@lunas.local', skills: ['power wash', 'detail'], capacityPerDay: 3 },
  { name: 'Raudel Crew', foremanEmail: 'raudel@lunas.local', skills: ['final'], capacityPerDay: 5 },
  { name: 'Francisco Crew', foremanEmail: 'francisco@lunas.local', skills: ['extras', 'service'], capacityPerDay: 2 },
];

async function ensureUser(db: ReturnType<typeof getPgDrizzle>['db'], email: string, name: string) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return existing.id;
  const [created] = await db
    .insert(users)
    .values({ email, name, role: 'contractor' })
    .onConflictDoNothing()
    .returning();
  if (created) return created.id;
  const fallback = await db.query.users.findFirst({ where: eq(users.email, email) });
  return fallback?.id;
}

async function main() {
  const { db, client } = getPgDrizzle();
  try {
    for (const crew of CREWS) {
      const foremanId = await ensureUser(db, crew.foremanEmail, crew.name.split(' ')[0]);
      if (!foremanId) continue;
      const existing = await db.query.crews.findFirst({ where: eq(crews.name, crew.name) });
      if (existing) continue;
      await db.insert(crews).values({
        name: crew.name,
        foremanId,
        skills: crew.skills,
        capacityPerDay: crew.capacityPerDay,
      });
      console.log('[seed-crews] inserted', crew.name);
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[seed-crews] ❌', err);
  process.exit(1);
});
