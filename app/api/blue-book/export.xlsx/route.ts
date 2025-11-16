import { getDb } from '@/lib/db/get-db';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

const db = await getDb();

export async function GET() {
  const entries = await db.query.blueBookEntries.findMany();

  const worksheet = XLSX.utils.json_to_sheet(entries);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Blue Book');

  const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="blue-book.xlsx"',
    },
  });
}
