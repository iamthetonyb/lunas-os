import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { jobRequestServices } from '@/db/schema/job_request_services';
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

        // Update the job_request_service with the assigned foreman
        await db.update(jobRequestServices)
            .set({ assignedForemanName: foremanName || null })
            .where(eq(jobRequestServices.id, jobId));

        return json({ ok: true, message: 'Foreman assigned successfully' });
    } catch (error) {
        console.error('Error assigning foreman:', error);
        return json({ error: (error as Error).message ?? 'Failed to assign foreman' }, 500);
    }
}
