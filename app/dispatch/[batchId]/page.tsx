'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { use } from 'react';

export default function DispatchBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  // Unwrap params using React.use() for Next.js 15
  const { batchId } = use(params);
  
  return (
    <>
      <PageHeader 
        title={`Dispatch Batch: ${batchId}`}
        description="View and manage batch details"
        action={
          <Link href="/dispatch" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
            ← Back to Batches
          </Link>
        }
      />
      <main className="px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Batch Details</h3>
          <p className="text-gray-600">Batch {batchId} details will be displayed here</p>
        </div>
      </main>
    </>
  );
}
