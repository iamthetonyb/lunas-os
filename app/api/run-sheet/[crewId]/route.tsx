import { NextResponse, type NextRequest } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { renderToStream } from '@react-pdf/renderer';
import { RunSheetPdf } from '@/components/run-sheet-pdf';
import QRCode from 'qrcode';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ crewId: string }> }) {
  const resolvedParams = await params;
  const { crewId } = resolvedParams;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  // Get schedule jobs for the date range
  const jobs = await convex.query(api.queries.getScheduleJobs, {
    startDate: date,
    endDate: date,
  });

  // Filter by crew name (crewId param is actually crew name in this context)
  const crewJobs = jobs.filter((j: any) => j.assignedCrewName === crewId);

  const assignmentsWithQrCodes = await Promise.all(crewJobs.map(async (job: any) => {
    const qrCodeDataUrl = await QRCode.toDataURL(`${process.env.NEXTAUTH_URL || 'http://localhost:4010'}/t/${job.id}`);
    return { ...job, qrCodeDataUrl };
  }));

  const pdfStream = await renderToStream(<RunSheetPdf assignments={assignmentsWithQrCodes} />);

  return new Response(pdfStream as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="run-sheet-${crewId}.pdf"`,
    },
  });
}
