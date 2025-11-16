import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/get-db';
import { orgs, serviceLogs } from '@/db/schema';
import { publishOrgEvent } from '@/lib/ably';

const CRON_HEADER = 'x-cron-key';

export const runtime = 'nodejs';

const db = await getDb();

type HarvestLog = {
  date: string;
  projectName?: string | null;
  builder?: string | null;
  community?: string | null;
  address?: string | null;
  lot?: string | null;
  unitLot?: string | null;
  serviceType?: string | null;
  category?: string | null;
  status?: string | null;
  timeIn?: string | null;
  timeOut?: string | null;
  hours?: number | null;
  team?: string[] | null;
  extras?: string | null;
  supervisor?: string | null;
  foreman?: string | null;
  crewLeader?: string | null;
  explainWork?: string | null;
  amount?: number | null;
  externalId?: string | null;
};

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Cron key not configured' }, { status: 500 });
  }

  const providedKey = req.headers.get(CRON_HEADER);
  if (providedKey !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const items: HarvestLog[] = Array.isArray(body?.items) ? body.items : [];
  const orgId: string | null = body?.orgId ?? null;

  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  if (!(await db.query.orgs.findFirst({ where: eq(orgs.id, orgId) }))) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  let upserted = 0;

  for (const item of items) {
    if (!item.date) continue;

    const baseRecord = {
      orgId,
      date: item.date,
      projectName: item.projectName ?? null,
      builder: item.builder ?? null,
      community: item.community ?? null,
      address: item.address ?? null,
      lot: item.lot ?? null,
      unitLot: item.unitLot ?? null,
      serviceType: item.serviceType ?? null,
      category: item.category ?? null,
      status: item.status ?? null,
      timeIn: item.timeIn ?? null,
      timeOut: item.timeOut ?? null,
      hours: item.hours ?? null,
      team: item.team ?? null,
      extras: item.extras ?? null,
      supervisor: item.supervisor ?? null,
      foreman: item.foreman ?? null,
      crewLeader: item.crewLeader ?? null,
      explainWork: item.explainWork ?? null,
      amount: item.amount ?? null,
      source: 'pulte-scrape',
      externalId: item.externalId ?? null,
    };

    if (baseRecord.externalId) {
      await db
        .insert(serviceLogs)
        .values(baseRecord)
        .onConflictDoUpdate({
          target: [serviceLogs.orgId, serviceLogs.externalId],
          set: {
            ...baseRecord,
            updatedAt: new Date(),
          },
        });
    } else {
      await db.insert(serviceLogs).values(baseRecord);
    }
    upserted += 1;
  }

  if (upserted > 0) {
    await publishOrgEvent(orgId, 'serviceLogs.updated', { source: 'pulte' });
  }

  return NextResponse.json({ ok: true, upserted });
}
