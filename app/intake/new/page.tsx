'use client';

import { AppLayout } from '@/components/app-layout';
import { PageHeader } from '@/components/page-header';
import { IntakeForm } from '@/components/intake-form';
import Link from 'next/link';

export default function NewIntakePage() {
  return (
    <AppLayout>
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
    </AppLayout>
  );
}
