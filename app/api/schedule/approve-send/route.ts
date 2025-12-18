import { approveAndSend } from '@/services/scheduling';
import { NextResponse } from 'next/server';
import { requireMembership } from '@/lib/auth/guards';
import { publishOrgEvent } from '@/lib/ably';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const membership = await requireMembership(['admin', 'backoffice']);
    const { assignmentIds } = await req.json();

    if (!assignmentIds || !Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return NextResponse.json({ error: 'Assignment IDs are required' }, { status: 400 });
    }

    const dispatchBatch = await approveAndSend(assignmentIds);

    // Publish realtime event
    await publishOrgEvent(membership.orgId, 'dispatch.updated', { batchCount: dispatchBatch?.length || 0 });

    return NextResponse.json(dispatchBatch);
  } catch (error) {
    console.error('[approve-send] Error:', error);
    return NextResponse.json({ error: 'Failed to approve and send' }, { status: 500 });
  }
}
