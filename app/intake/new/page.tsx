'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Lazy load the form and disable Server-Side Rendering (SSR) for it
const IntakeForm = dynamic(
  () => import('@/components/intake-form').then((mod) => mod.IntakeForm),
  { ssr: false }
);

export default function NewIntakePage() {
  return (
    <>
      <PageHeader
        title="New Intake"
        description="Create a new job intake request"
        action={
          <Link href="/intake" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
            ← Back to Intakes
          </Link>
        }
      />
      <main className="px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <IntakeForm />
        </div>
      </main>
    </>
  );
}
