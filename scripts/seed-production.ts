
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { eq, sql } from 'drizzle-orm';
import { getPgDrizzle } from './db-client';
import { users, orgs, orgMembers, crews } from '@/db/schema';

// Production Crew Data
const CREWS = [
    { name: 'Anahi', foremanEmail: 'anahi@lunas.local' },
    { name: 'Chayo', foremanEmail: 'chayo@lunas.local' },
    { name: 'Blanca', foremanEmail: 'blanca@lunas.local' },
    { name: 'Raudel', foremanEmail: 'raudel@lunas.local' },
    { name: 'Francisco', foremanEmail: 'francisco@lunas.local' },
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
        // Also UPDATE PASSWORD to match current standard
        await db.update(users).set({ role, passwordHash }).where(eq(users.id, existing.id));
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

        // Update to specific requested password
        const defaultPassword = 'dev123';
        const hash = await bcrypt.hash(defaultPassword, 10);

        // 2. Ensure Crews & Foremen
        for (const crew of CREWS) {
            const foremanName = crew.name; // Name matches crew name (e.g. "Anahi")
            const foremanId = await ensureUser(db, crew.foremanEmail, foremanName, 'contractor', hash, orgId);

            // Explicitly set to FOREMAN role for dropdowns
            await db.update(users).set({ role: 'FOREMAN' }).where(eq(users.id, foremanId));

            const existingCrew = await db.query.crews.findFirst({ where: eq(crews.name, crew.name) });
            if (!existingCrew) {
                await db.insert(crews).values({
                    name: crew.name,
                    foremanId,
                    // skills and capacity left null/default as requested
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

        console.log('[seed] 🏁 Production seed complete. All contractors set to "dev123".');
    } catch (error) {
        console.error('[seed] ❌ Failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
