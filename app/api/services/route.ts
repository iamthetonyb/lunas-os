import { db } from '@/db';
import { services } from '@/db/schema';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const allServices = await db.query.services.findMany();
    return NextResponse.json(allServices || [], {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    // Return empty array instead of error to prevent crash
    return NextResponse.json([], {
      status: 200, // Return 200 to prevent client-side errors
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const newService = await db.insert(services).values(data).returning();
    return NextResponse.json(newService[0]);
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}
