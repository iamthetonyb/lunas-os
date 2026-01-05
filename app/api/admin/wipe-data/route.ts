import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/get-db';
import { auth } from '@/auth';
import {
    blueBookEntries,
    jobRequests,
    assignments,
    dispatchBatches,
    fieldTickets,
    invoiceLines,
    jobRequestServices
} from '@/db/schema';
import { eq, lt, sql } from 'drizzle-orm';

// Helper to check for admin role
function isAdmin(user: any) {
    return user?.role === 'ADMIN' || user?.role === 'admin';
}

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user)) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const db = await getDb();
        await db.transaction(async (tx) => {
            // Step 1: Unlink Blue Book Entries from Assignments
            // This allows us to delete the assignments without violating specific FKs if they exist
            await tx.update(blueBookEntries)
                .set({ assignmentId: null });

            // Step 2: Delete Dependencies (Tickets, Invoice Lines, Job Services)
            // Delete everything
            await tx.delete(fieldTickets);
            await tx.delete(invoiceLines);
            await tx.delete(jobRequestServices);

            // Step 3: Delete Assignments and Batches
            await tx.delete(assignments);
            await tx.delete(dispatchBatches);

            // Step 4: Delete Job Requests
            await tx.delete(jobRequests);

            // Step 5: Delete Old Blue Book Entries (Before Jan 5th, 2026)
            // Keep everything created on or after 2026-01-05
            const cutoffDate = new Date('2026-01-05T00:00:00Z');

            await tx.delete(blueBookEntries)
                .where(lt(blueBookEntries.createdAt, cutoffDate));
        });

        return NextResponse.json({
            success: true,
            message: 'System data wiped successfully (Settings preserved, Data < 01/05/2026 removed).'
        });

    } catch (error) {
        console.error('Wipe Data Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
