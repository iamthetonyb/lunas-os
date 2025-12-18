import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { jobRequestServices, blueBookEntries } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function POST(request: Request) {
    try {
        const db = await getDb();
        const body = await request.json();
        const { jobId, foremanName } = body;

        if (!jobId) {
            return json({ error: 'Job ID is required' }, 400);
        }

        // 1. Try to update job_request_service
        const serviceUpdate = await db.update(jobRequestServices)
            .set({ assignedForemanName: foremanName || null })
            .where(eq(jobRequestServices.id, jobId));

        // 2. Try to update blue_book_entry
        // (If it wasn't a job_request_service, it might be a blue_book_entry)
        await db.update(blueBookEntries)
            .set({ assignedForemanName: foremanName || null })
            .where(eq(blueBookEntries.id, jobId));

        return json({ ok: true, message: 'Foreman assigned successfully' });
    } catch (error) {
        console.error('Error assigning foreman:', error);
        return json({ error: (error as Error).message ?? 'Failed to assign foreman' }, 500);
    }
}
