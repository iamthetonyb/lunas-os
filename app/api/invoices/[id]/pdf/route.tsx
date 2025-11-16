import { getDb } from '@/lib/db/get-db';
import { invoices } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { renderToStream } from '@react-pdf/renderer';
import { InvoicePdf } from '@/components/invoice-pdf';
import { json } from '@/lib/utils/json';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, params.id),
      with: {
        invoiceLines: true,
        builder: true,
      },
    });

    if (!invoice) {
      return json({ ok: false, error: 'Invoice not found' }, 404);
    }

    const pdfStream = await renderToStream(<InvoicePdf invoice={invoice} />);

    return new Response(pdfStream as any, {
      headers: {
        'Content-Type': 'application/pdf',
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to generate invoice PDF' }, 500);
  }
}
