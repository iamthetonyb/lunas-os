
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { eq, sql } from 'drizzle-orm';
import { getPgDrizzle } from './db-client';
import { users, orgs, orgMembers, crews } from '@/db/schema';

// Production Crew Data
const CREWS = [
    { name: 'Anahi Crew', foremanEmail: 'anahi@lunas.local', skills: ['cleanup', 'frame'], capacityPerDay: 4 },
    { name: 'Chayo Crew', foremanEmail: 'chayo@lunas.local', skills: ['tubs', 'windows'], capacityPerDay: 3 },
    { name: 'Blanca Crew', foremanEmail: 'blanca@lunas.local', skills: ['power wash', 'detail'], capacityPerDay: 3 },
    { name: 'Raudel Crew', foremanEmail: 'raudel@lunas.local', skills: ['final'], capacityPerDay: 5 },
    { name: 'Francisco Crew', foremanEmail: 'francisco@lunas.local', skills: ['extras', 'service'], capacityPerDay: 2 },
];

async function ensureOrg(db: ReturnType<typeof getPgDrizzle>['db']) {
    const orgName = 'Lunas';
    const slug = 'lunas';

    const [existing] = await db.select().from(orgs).where(eq(orgs.slug, slug));
    if (existing) return existing.id;

    const [created] = await db.insert(orgs).values({ name: orgName, slug }).returning();
    return created.id;
}

async function ensureUser(
    db: ReturnType<typeof getPgDrizzle>['db'],
    email: string,
    name: string,
    role: 'admin' | 'contractor' = 'contractor',
    passwordHash: string,
    orgId: string
) {
    let userId;
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });

    if (existing) {
        // Ensure role is correct if upgrading/fixing
        if (existing.role !== role) {
            await db.update(users).set({ role }).where(eq(users.id, existing.id));
        }
        userId = existing.id;
    } else {
        const [created] = await db
            .insert(users)
            .values({ email, name, role, passwordHash })
            .returning();
        userId = created.id;
    }

    // Ensure Org Membership
    const member = await db.query.orgMembers.findFirst({
        where: (om, { and, eq }) => and(eq(om.orgId, orgId), eq(om.userId, userId))
    });

    if (!member) {
        await db.insert(orgMembers).values({
            orgId,
            userId,
            role: role === 'admin' ? 'admin' : 'contractor'
        });
    }

    return userId;
}

async function main() {
    const { db, client } = getPgDrizzle();
    console.log('[seed] 🌱 Starting production seed...');

    try {
        // 1. Ensure Org
        const orgId = await ensureOrg(db);
        console.log('[seed] ✅ Org:', orgId);

        const defaultPassword = process.env.DEV_PASSWORD || 'dev';
        const hash = await bcrypt.hash(defaultPassword, 10);

        // 2. Ensure Admin
        await ensureUser(db, 'tony@lunas.local', 'Tony', 'admin', hash, orgId);
        console.log('[seed] ✅ Admin: tony@lunas.local');

        // 3. Ensure Crews & Foremen
        for (const crew of CREWS) {
            const foremanName = crew.name.split(' ')[0];
            const foremanId = await ensureUser(db, crew.foremanEmail, foremanName, 'contractor', hash, orgId);

            // Update User to be FOREMAN role in main user table if needed? 
            // Schema says 'role' enum includes 'FOREMAN'. Our ensureUser used 'contractor' above.
            // Let's explicitly set them to FOREMAN role for the dropdowns to work if that's what filters them.
            // Checking schema... users.role is 'role' enum: 'FOREMAN', 'CREW', etc.
            // BUT org_members.role is 'admin' | 'contractor'.
            // The dropdown likely filters by users.role = 'FOREMAN'.

            await db.update(users).set({ role: 'FOREMAN' }).where(eq(users.id, foremanId));

            const existingCrew = await db.query.crews.findFirst({ where: eq(crews.name, crew.name) });
            if (!existingCrew) {
                await db.insert(crews).values({
                    name: crew.name,
                    foremanId,
                    skills: crew.skills as any, // Cast for string[] array
                    capacityPerDay: crew.capacityPerDay,
                });
                console.log(`[seed] ✅ Crew created: ${crew.name}`);
            } else {
                // Ensure linked foreman is correct
                if (existingCrew.foremanId !== foremanId) {
                    await db.update(crews).set({ foremanId }).where(eq(crews.id, existingCrew.id));
                    console.log(`[seed] 🔄 Crew updated: ${crew.name}`);
                }
            }
        }

        console.log('[seed] 🏁 Production seed complete.');
    } catch (error) {
        console.error('[seed] ❌ Failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
