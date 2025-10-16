import { db } from '@/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const builders = await db.query.builders.findMany();
    return NextResponse.json(builders);
  } catch (error) {
    console.error('Error fetching builders:', error);
    return NextResponse.json({ error: 'Failed to fetch builders' }, { status: 500 });
  }
}
