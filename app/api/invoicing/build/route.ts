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
      modelPlan: true,
    },
  });

  let subtotal = 0;
  const newInvoiceLinesData = entriesToInvoice.map(entry => {
    let qty = 1;
    if (entry.service && entry.service.unitKind === 'PER_SQFT') {
      qty = Number(entry.modelPlan?.sqft) || 1;
    }

    const unitPrice = Number(entry.amount) || 0;
    const amount = qty * unitPrice;
    subtotal += amount;

    return {
      description: entry.service?.name || 'Unknown Service',
      qty: String(qty),
      unit: entry.service?.unitKind || 'EACH',
      unitPrice: String(unitPrice.toFixed(2)),
      amount: String(amount.toFixed(2)),
      blueBookId: entry.id,
    };
  });

  const taxRate = process.env.TAX_RATE ? Number(process.env.TAX_RATE) : 0;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const newInvoice = await db.insert(invoices).values({
    builderId,
    subtotal: String(subtotal.toFixed(2)),
    tax: String(tax.toFixed(2)),
    total: String(total.toFixed(2)),
    status: 'DRAFT',
  }).returning();

  const createdInvoiceLines = await db.insert(invoiceLines).values(
    newInvoiceLinesData.map(line => ({
      ...line,
      invoiceId: newInvoice[0].id,
    }))
  ).returning();

  for (const line of createdInvoiceLines) {
    if (line.blueBookId) {
      await db.update(blueBookEntries).set({
        invoiceLineId: line.id,
      }).where(eq(blueBookEntries.id, line.blueBookId));
    }
  }

  return NextResponse.json(newInvoice[0]);
}
