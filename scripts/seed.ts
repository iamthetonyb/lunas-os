import 'dotenv/config';
import bcrypt from 'bcrypt';
import { eq, sql } from 'drizzle-orm';
import { getPgDrizzle } from './db-client';

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  const { db, client, schema } = getPgDrizzle();
  const { users, orgs, orgMembers } = schema as Record<string, any>;

  try {
    const orgName = 'Lunas';
    const slug = slugify(orgName);
    const [org] = await db
      .insert(orgs)
      .values({ name: orgName, slug })
      .onConflictDoNothing()
      .returning();

    if (!org) {
      await db.execute(sql`
        UPDATE orgs
        SET slug = lower(regexp_replace(name, '[^a-z0-9]+', '-', 'g'))
        WHERE slug IS NULL
      `);
    }

    const orgRow = await db
      .select({ id: orgs.id })
      .from(orgs)
      .where(eq(orgs.name, orgName))
      .limit(1);
    const orgId = orgRow[0]?.id;

    const emails = (process.env.DEV_EMAILS || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    const password = process.env.DEV_PASSWORD || 'dev';

    if (!emails.length) {
      console.log('No DEV_EMAILS provided; skipping seed.');
      return;
    }

    const hash = await bcrypt.hash(password, 10);

    for (const email of emails) {
      const name = email.split('@')[0];
      const [u] = await db
        .insert(users)
        .values({
          email,
          name,
          role: 'admin',
          passwordHash: hash,
        })
        .onConflictDoNothing()
        .returning();

      if (u?.id && orgId) {
        await db
          .insert(orgMembers)
        .values({ orgId, userId: u.id, role: 'admin' })
          .onConflictDoNothing();
      }
    }

    console.log('[seed] ok:', { orgId, emails });
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
