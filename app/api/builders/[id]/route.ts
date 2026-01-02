import { getDb } from '@/lib/db/get-db';
import { builders } from '@/db/schema';
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
            return json({ ok: false, error: 'Builder name is required' }, 400);
        }

        const [updated] = await db.update(builders)
            .set({ name: body.name.trim() })
            .where(eq(builders.id, id))
            .returning();

        if (!updated) {
            return json({ ok: false, error: 'Builder not found' }, 404);
        }

        return json(updated);
    } catch (error) {
        console.error('Error updating builder:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to update builder' }, 500);
    }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        await requireMembership(['admin', 'backoffice']);
        const db = await getDb();
        const { id } = await context.params;

        const [deleted] = await db.delete(builders)
            .where(eq(builders.id, id))
            .returning();

        if (!deleted) {
            return json({ ok: false, error: 'Builder not found' }, 404);
        }

        return json({ ok: true });
    } catch (error) {
        console.error('Error deleting builder:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to delete builder' }, 500);
    }
}
