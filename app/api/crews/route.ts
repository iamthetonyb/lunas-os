import { db } from '@/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const allCrews = await db.query.crews.findMany();
    return NextResponse.json(allCrews);
  } catch (error) {
    console.error('Error fetching crews:', error);
    return NextResponse.json({ error: 'Failed to fetch crews' }, { status: 500 });
  }
}
