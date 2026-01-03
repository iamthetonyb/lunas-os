import { getDb } from '@/lib/db/get-db';
import { communities } from '@/db/schema';
import { json } from '@/lib/utils/json';
import { requireMembership } from '@/lib/auth/guards';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        await requireMembership(['admin', 'backoffice']);
        const db = await getDb();
        const { id } = await context.params;
        const body = await req.json();

        if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
            return json({ ok: false, error: 'Community name is required' }, 400);
        }

        const [updated] = await db.update(communities)
            .set({ name: body.name.trim() })
            .where(eq(communities.id, id))
            .returning();

        if (!updated) {
            return json({ ok: false, error: 'Community not found' }, 404);
        }

        return json(updated);
    } catch (error) {
        console.error('Error updating community:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to update community' }, 500);
    }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        await requireMembership(['admin', 'backoffice']);
        const db = await getDb();
        const { id } = await context.params;

        // Soft delete: set active = false instead of hard delete
        const [deactivated] = await db.update(communities)
            .set({ active: false })
            .where(eq(communities.id, id))
            .returning();

        if (!deactivated) {
            return json({ ok: false, error: 'Community not found' }, 404);
        }

        return json({ ok: true, message: 'Community deactivated' });
    } catch (error) {
        console.error('Error deleting community:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to delete community' }, 500);
    }
}
