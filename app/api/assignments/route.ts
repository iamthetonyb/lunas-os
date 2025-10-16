import { db } from '@/db';
import { assignments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    if (status) {
      const filteredAssignments = await db.query.assignments.findMany({
        where: eq(assignments.status, status as any),
      });
      return NextResponse.json(filteredAssignments || [], {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    const allAssignments = await db.query.assignments.findMany();
    return NextResponse.json(allAssignments || [], {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    // Return empty array with 200 status to prevent crashes
    return NextResponse.json([], {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }
}
