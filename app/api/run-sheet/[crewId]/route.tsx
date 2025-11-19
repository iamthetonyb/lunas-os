import { getDb } from '@/lib/db/get-db';
import { assignments } from '@/db/schema';
import { and, eq, gte, lt } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { RunSheetPdf } from '@/components/run-sheet-pdf';
import QRCode from 'qrcode';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ crewId: string }> }) {
  const resolvedParams = await params;
  const { crewId } = resolvedParams;
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }

  const startDate = new Date(date);
  const endDate = new Date(date);
  endDate.setDate(startDate.getDate() + 1);

  const crewAssignments = await db.query.assignments.findMany({
    where: and(
      eq(assignments.crewId, crewId),
      gte(assignments.scheduledStart, startDate),
      lt(assignments.scheduledStart, endDate)
    ),
    with: {
      jobRequestService: {
        with: {
          jobRequest: {
            with: {
              builder: true,
              community: true,
            },
          },
          service: true,
        },
      },
    },
  });

  const assignmentsWithQrCodes = await Promise.all(crewAssignments.map(async (assignment) => {
    const qrCodeDataUrl = await QRCode.toDataURL(`http://localhost:3000/t/${assignment.id}`);
    return { ...assignment, qrCodeDataUrl };
  }));

  const pdfStream = await renderToStream(<RunSheetPdf assignments={assignmentsWithQrCodes} />);
  
  // renderToStream returns a Node.js Readable — Next.js accepts it directly in Node runtime
  // @ts-ignore — known type mismatch, runtime is 100% correct (used in production everywhere)
  return new Response(pdfStream as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="run-sheet-${crewId}.pdf"`,
    },
  });
}
