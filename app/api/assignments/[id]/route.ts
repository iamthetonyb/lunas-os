import { db } from '@/db';
import { assignments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const assignment = await db.query.assignments.findFirst({
    where: eq(assignments.id, params.id),
  });

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  return NextResponse.json(assignment);
}
