import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

/**
 * GET /api/users/foreman-contact?name={foremanName}
 * Returns contact info for a foreman
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const name = searchParams.get('name');

        if (!name) {
            return json({ ok: false, error: 'name is required' }, 400);
        }

        const db = await getDb();

        // Find user by name (case-insensitive partial match)
        const allUsers = await db.select().from(users);
        const foreman = allUsers.find(
            (u) => u.name?.toLowerCase().includes(name.toLowerCase())
        );

        if (!foreman) {
            return json({ ok: false, contact: null, message: 'Foreman not found' });
        }

        // Return contact based on preferred method
        const preferredMethod = foreman.preferredContactMethod ?? 'email';
        const contact = preferredMethod === 'phone'
            ? foreman.phone
            : foreman.email;

        return json({
            ok: true,
            contact,
            preferredMethod,
            phone: foreman.phone,
            email: foreman.email,
        });
    } catch (error) {
        console.error('Error fetching foreman contact:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to load contact' }, 500);
    }
}
