import { approveAndSend } from '@/services/scheduling';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { assignmentIds } = await req.json();

  if (!assignmentIds || !Array.isArray(assignmentIds) || assignmentIds.length === 0) {
    return NextResponse.json({ error: 'Assignment IDs are required' }, { status: 400 });
  }

  try {
    const dispatchBatch = await approveAndSend(assignmentIds);
    return NextResponse.json(dispatchBatch);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to approve and send' }, { status: 500 });
  }
}
