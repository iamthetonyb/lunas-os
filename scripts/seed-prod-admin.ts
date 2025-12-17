#!/usr/bin/env tsx
/**
 * Seed admin user in production database
 * Run with: pnpm tsx scripts/seed-prod-admin.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, orgs, orgMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const DATABASE_URL = process.env.DATABASE_URL || process.env.PROD_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL or PROD_DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('🔌 Connecting to production database...');
  
  const client = postgres(DATABASE_URL, { prepare: false });
  const db = drizzle(client, { schema: { users, orgs, orgMembers } });

  try {
    // Check if admin user exists
    const adminEmail = 'admin@lunas.local';
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, adminEmail),
    });

    if (existingUser) {
      console.log('✅ Admin user already exists:', adminEmail);
      console.log('   User ID:', existingUser.id);
      console.log('   Role:', existingUser.role);
      console.log('   Has password:', existingUser.passwordHash ? 'Yes' : 'No');
      
      // Update password if needed
      const devPassword = process.env.DEV_PASSWORD || 'dev';
      const hashedPassword = await bcrypt.hash(devPassword, 10);
      
      await db.update(users)
        .set({ passwordHash: hashedPassword })
        .where(eq(users.id, existingUser.id));
      
      console.log('✅ Updated password hash');
      await client.end();
      return;
    }

    console.log('📝 Creating admin user...');
    
    // Create default org first
    const [defaultOrg] = await db.insert(orgs)
      .values({
        name: 'Lunas Construction',
        slug: 'lunas-construction',
      })
      .onConflictDoNothing()
      .returning();

    const orgId = defaultOrg?.id || (await db.query.orgs.findFirst())?.id;

    if (!orgId) {
      throw new Error('Failed to create or find default org');
    }

    // Create admin user
    const devPassword = process.env.DEV_PASSWORD || 'dev';
    const hashedPassword = await bcrypt.hash(devPassword, 10);

    const [newUser] = await db.insert(users)
      .values({
        email: adminEmail,
        name: 'admin',
        role: 'ADMIN',
        passwordHash: hashedPassword,
      })
      .returning();

    console.log('✅ Created admin user:', newUser.email);

    // Add to org
    await db.insert(orgMembers)
      .values({
        userId: newUser.id,
        orgId: orgId,
        role: 'ADMIN',
      })
      .onConflictDoNothing();

    console.log('✅ Added admin to org');
    console.log('');
    console.log('🎉 Admin user ready!');
    console.log('   Email:', adminEmail);
    console.log('   Password:', devPassword);
    console.log('   Login at: https://lunas-app-pwfcl.ondigitalocean.app/login');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
