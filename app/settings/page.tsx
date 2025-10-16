'use client';

import { AppLayout } from '@/components/app-layout';
import { PageHeader } from '@/components/page-header';

export default function SettingsPage() {
  return (
    <AppLayout>
      <PageHeader 
        title="Settings" 
        description="Configure system settings and preferences"
      />
      <main className="px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h3>
            <p className="text-gray-600">General configuration options</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
            <p className="text-gray-600">Notification preferences</p>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
