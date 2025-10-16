import { db } from '@/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const communities = await db.query.communities.findMany();
    return NextResponse.json(communities);
  } catch (error) {
    console.error('Error fetching communities:', error);
    return NextResponse.json({ error: 'Failed to fetch communities' }, { status: 500 });
  }
}
