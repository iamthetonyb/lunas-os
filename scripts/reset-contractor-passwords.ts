import { getDb } from '../lib/db/get-db';
import { users } from '../db/schema';
import { eq, or, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function main() {
    console.log('Starting contractor password reset...');
    const db = await getDb();

    const hashedPassword = await bcrypt.hash('dev', 10);

    // Update all users with roles FOREMAN or CREW
    const updated = await db
        .update(users)
        .set({
            passwordHash: hashedPassword,
            updatedAt: new Date(),
        })
        .where(
            inArray(users.role, ['FOREMAN', 'CREW'])
        )
        .returning({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
        });

    console.log(`Successfully updated ${updated.length} users:`);
    updated.forEach(u => {
        console.log(`- ${u.name} (${u.email}) [${u.role}]`);
    });

    process.exit(0);
}

main().catch(err => {
    console.error('Failed to reset passwords:', err);
    process.exit(1);
});
