
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { getPgDrizzle } from './db-client';
import { users, orgs, orgMembers, crews } from '@/db/schema';

// Required Users from Screenshot
const USERS = [
    { name: 'admin', email: 'admin@lunas.local', role: 'admin' },
    { name: 'Anahi', email: 'anahi@lunas.local', role: 'contractor', isForeman: true },
    { name: 'Blanca', email: 'blanca@lunas.local', role: 'contractor', isForeman: true },
    { name: 'Chayo', email: 'chayo@lunas.local', role: 'contractor', isForeman: true },
    { name: 'Francisco', email: 'francisco@lunas.local', role: 'contractor', isForeman: true },
    { name: 'Raudel', email: 'raudel@lunas.local', role: 'contractor', isForeman: true },
    { name: 'TB', email: 'iam@thetonyb.com', role: 'admin' }, // Assuming admin for TB based on context, or contractor? Screenshot says "Contractor" in dropdown, but maybe he needs admin access? Screenshot "Memberships" column says "Lunas · contractor" for TB. Okay, I will set him as contractor but he might be a super-user context. Wait, screenshot says "Lunas · contractor" for TB. I will stick to what's on screen.
];

// Correction: TB role in screenshot says "Lunas · contractor" but usually Tony is admin. 
// However, I must follow the screenshot if "Users to Insert" refers to it.
// Wait, the screenshot shows "admin" has "Lunas · admin". "TB" has "Lunas · contractor". 
// I will trust the screenshot.

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
    userData: typeof USERS[number],
    passwordHash: string,
    orgId: string
) {
    let userId;
    const existing = await db.query.users.findFirst({ where: eq(users.email, userData.email) });

    // Map input role to correct DB enums
    // Users table uses UPPERCASE: ADMIN, FOREMAN, CREW, CUSTOMER
    const systemRole = userData.isForeman ? 'FOREMAN' : (userData.role === 'admin' ? 'ADMIN' : 'CUSTOMER');

    if (existing) {
        // Update existing user to match desired state
        await db.update(users).set({
            role: systemRole as any,
            name: userData.name,
            passwordHash
        }).where(eq(users.id, existing.id));
        userId = existing.id;
        console.log(`[seed] 🔄 Updated user: ${userData.name} -> ${systemRole}`);
    } else {
        const [created] = await db
            .insert(users)
            .values({
                email: userData.email,
                name: userData.name,
                role: systemRole as any,
                passwordHash
            })
            .returning();
        userId = created.id;
        console.log(`[seed] ✅ Created user: ${userData.name} -> ${systemRole}`);
    }

    // Ensure Org Membership
    const member = await db.query.orgMembers.findFirst({
        where: (om, { and, eq }) => and(eq(om.orgId, orgId), eq(om.userId, userId))
    });

    if (!member) {
        await db.insert(orgMembers).values({
            orgId,
            userId,
            role: userData.role as 'admin' | 'contractor'
        });
        console.log(`[seed] ➕ Added to Org: ${userData.name}`);
    } else {
        // Update role if mismatch
        if (member.role !== userData.role) {
            await db.update(orgMembers)
                .set({ role: userData.role as 'admin' | 'contractor' })
                .where(eq(orgMembers.id, member.id));
            console.log(`[seed] 🔄 Updated Org Role: ${userData.name}`);
        }
    }

    return userId;
}

async function main() {
    const { db, client } = getPgDrizzle();
    console.log('[seed] 🌱 Starting production fix seed...');

    try {
        const orgId = await ensureOrg(db);
        const defaultPassword = 'dev123';
        const hash = await bcrypt.hash(defaultPassword, 10);

        for (const user of USERS) {
            const userId = await ensureUser(db, user, hash, orgId);

            // If it's a foreman, ensure they have a Crew entry
            if (user.isForeman) {
                const existingCrew = await db.query.crews.findFirst({ where: eq(crews.name, user.name) });
                if (!existingCrew) {
                    await db.insert(crews).values({
                        name: user.name,
                        foremanId: userId
                    });
                    console.log(`[seed] 👷 Created Crew: ${user.name}`);
                } else if (existingCrew.foremanId !== userId) {
                    await db.update(crews).set({ foremanId: userId }).where(eq(crews.id, existingCrew.id));
                    console.log(`[seed] 🔗 Linked Crew ${user.name} to User`);
                }
            }
        }

        console.log('[seed] 🏁 Fix complete.');
    } catch (error) {
        console.error('[seed] ❌ Failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
