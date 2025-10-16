import { db } from '@/db';
import { jobRequests, jobRequestServices } from '@/db/schema';
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json();

  const { serviceIds, ...jobRequestData } = data;

  const newJobRequest = await db.insert(jobRequests).values({
    ...jobRequestData,
    createdById: session.user.id,
  }).returning();

  if (serviceIds && serviceIds.length > 0) {
    await db.insert(jobRequestServices).values(
      serviceIds.map((serviceId: string) => ({
        jobRequestId: newJobRequest[0].id,
        serviceId,
      }))
    );
  }

  return NextResponse.json(newJobRequest[0]);
}
