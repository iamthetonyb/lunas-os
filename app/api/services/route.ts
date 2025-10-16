import { db } from '@/db';
import { services } from '@/db/schema';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const allServices = await db.query.services.findMany();
    return NextResponse.json(allServices);
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
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
