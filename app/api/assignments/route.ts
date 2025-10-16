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
      return NextResponse.json(filteredAssignments);
    }

    const allAssignments = await db.query.assignments.findMany();
    return NextResponse.json(allAssignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}
