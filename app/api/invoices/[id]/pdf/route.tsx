import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { InvoicePdf } from '@/components/invoice-pdf';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, params.id),
    with: {
      invoiceLines: true,
      builder: true,
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const pdfStream = await renderToStream(<InvoicePdf invoice={invoice} />);
  
  return new Response(pdfStream, {
    headers: {
      'Content-Type': 'application/pdf',
    },
  });
}
