import { db } from '@/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const allCrews = await db.query.crews.findMany();
    return NextResponse.json(allCrews || [], {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching crews:', error);
    // Return empty array with 200 status to prevent crashes
    return NextResponse.json([], {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }
}
