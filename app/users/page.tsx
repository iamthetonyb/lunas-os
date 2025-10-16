'use client';

import { AppLayout } from '@/components/app-layout';
import { PageHeader } from '@/components/page-header';

export default function UsersPage() {
  return (
    <AppLayout>
      <PageHeader 
        title="Users" 
        description="Manage system users and permissions"
        action={
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + Add User
          </button>
        }
      />
      <main className="px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User List</h3>
          <p className="text-gray-600">User management interface will be displayed here</p>
        </div>
      </main>
    </AppLayout>
  );
}
