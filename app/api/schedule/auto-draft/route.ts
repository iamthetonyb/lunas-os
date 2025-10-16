import { autoDraft } from '@/services/scheduling';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }

  try {
    const draftAssignments = await autoDraft(new Date(date));
    return NextResponse.json(draftAssignments);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create auto-draft' }, { status: 500 });
  }
}
