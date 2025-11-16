import { getDb } from '@/lib/db/get-db';
import { invoices, invoiceLines, blueBookEntries } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const db = await getDb();

export async function POST(req: Request) {
  const { builderId, entryIds } = await req.json();

  const entriesToInvoice = await db.query.blueBookEntries.findMany({
    where: and(
      inArray(blueBookEntries.id, entryIds),
      eq(blueBookEntries.builderId, builderId)
    ),
    with: {
      service: true,
      jobRequestService: {
        with: {
          jobRequest: {
            with: {
              modelPlan: true,
            },
          },
        },
      },
    },
  });

  let subtotal = 0;
  const newInvoiceLinesData = entriesToInvoice.map(entry => {
    let qty = 1;
    if (entry.service.unitKind === 'PER_SQFT') {
      qty = Number(entry.jobRequestService.jobRequest.modelPlan?.sqft) || 1;
    } else if (entry.service.unitKind === 'PER_UNIT') {
      // @ts-ignore
      qty = entry.items?.windows || entry.items?.tubs || 1;
    }

    const amount = qty * (Number(entry.amount) || 0);
    subtotal += amount;

    return {
      description: entry.service.name,
      qty,
      unit: entry.service.unitKind,
      unitPrice: Number(entry.amount) || 0,
      amount,
      blueBookId: entry.id,
    };
  });

  const taxRate = process.env.TAX_RATE ? Number(process.env.TAX_RATE) : 0;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const newInvoice = await db.insert(invoices).values({
    builderId,
    subtotal,
    tax,
    total,
    status: 'DRAFT',
  }).returning();

  const createdInvoiceLines = await db.insert(invoiceLines).values(
    newInvoiceLinesData.map(line => ({
      ...line,
      invoiceId: newInvoice[0].id,
    }))
  ).returning();

  for (const line of createdInvoiceLines) {
    await db.update(blueBookEntries).set({
      invoiceLineId: line.id,
    }).where(eq(blueBookEntries.id, line.blueBookId));
  }

  return NextResponse.json(newInvoice[0]);
}
