import { NextRequest } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { renderToStream } from '@react-pdf/renderer';
import { InvoicePdf } from '@/components/invoice-pdf';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolved = await params;
    const { id } = resolved;

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const invoice = await convex.query(api.invoicing.getById, {
      id: id as Id<"invoices">,
    });

    if (!invoice) {
      return Response.json({ ok: false, error: 'Invoice not found' }, { status: 404 });
    }

    const pdfStream = await renderToStream(<InvoicePdf invoice={invoice} />);

    return new Response(pdfStream as any, {
      headers: {
        'Content-Type': 'application/pdf',
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return Response.json({ ok: false, error: (error as Error).message ?? 'Failed to generate invoice PDF' }, { status: 500 });
  }
}
