'use client';

import { AppLayout } from '@/components/app-layout';
import { PageHeader } from '@/components/page-header';
import Link from 'next/link';

export default function IntakePage() {
  return (
    <AppLayout>
      <PageHeader 
        title="Intake" 
        description="Manage job intake and new project submissions"
        action={
          <Link href="/intake/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + New Intake
          </Link>
        }
      />
      <main className="px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Intakes</h3>
          <p className="text-gray-600">Intake list will be displayed here</p>
        </div>
      </main>
    </AppLayout>
  );
}
