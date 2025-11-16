'use client';

import { PageHeader } from '@/components/page-header';
import useSWR, { mutate } from 'swr';
import { useMemo, useState } from 'react';
import { fetchJSON } from '@/lib/utils/fetch-json';

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  systemRole: string | null;
  memberships: { orgId: string; orgName: string; role: string }[];
};

type Org = {
  id: string;
  name: string;
  slug: string;
};

type AdminUsersResponse = {
  users: AdminUser[];
  orgs: Org[];
};

const fetcher = (url: string) => fetchJSON<AdminUsersResponse>(url);

export default function UsersPage() {
  const { data, isLoading, error } = useSWR<AdminUsersResponse>('/api/admin/users', fetcher);
  const [membership, setMembership] = useState({
    userId: '',
    orgId: '',
    role: 'contractor',
  });
  const [orgForm, setOrgForm] = useState({ name: '' });
  const [busy, setBusy] = useState(false);

  const sortedUsers = useMemo(() => {
    if (!data?.users) return [];
    return [...data.users].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [data?.users]);

  const handleMembershipSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!membership.userId || !membership.orgId) return;
    setBusy(true);
    try {
      await fetchJSON('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(membership),
      });
      await mutate('/api/admin/users');
      alert('Membership saved.');
    } catch (err) {
      console.error(err);
      alert('Failed to update membership.');
    } finally {
      setBusy(false);
    }
  };

  const handleOrgSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgForm.name.trim()) return;
    setBusy(true);
    try {
      await fetchJSON('/api/admin/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgForm.name }),
      });
      setOrgForm({ name: '' });
      await mutate('/api/admin/users');
      alert('Organization created.');
    } catch (err) {
      console.error(err);
      alert('Failed to create org.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage system users and permissions"
        action={
          <div className="text-sm text-gray-500">
            Need a fresh dataset? Run <code className="rounded bg-gray-100 px-2 py-1">pnpm db:reset</code>
          </div>
        }
      />
      <main className="px-6 py-6 space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Users</h3>
          {isLoading && <p className="text-gray-600">Loading…</p>}
          {error && <p className="text-red-600">Unable to load users.</p>}
          {!isLoading && !error && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Email</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Memberships</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3 text-gray-900">{user.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-900">{user.email}</td>
                      <td className="px-4 py-3 text-gray-900">
                        {user.memberships.length === 0 ? (
                          <span className="text-xs text-gray-500">No org access</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {user.memberships.map((membership) => (
                              <span
                                key={`${user.id}-${membership.orgId}`}
                                className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                              >
                                {membership.orgName} · {membership.role}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Org Role</h3>
          <form onSubmit={handleMembershipSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-gray-700">User</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={membership.userId}
                onChange={(e) => setMembership((prev) => ({ ...prev, userId: e.target.value }))}
              >
                <option value="">Select user…</option>
                {sortedUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Organization</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={membership.orgId}
                onChange={(e) => setMembership((prev) => ({ ...prev, orgId: e.target.value }))}
              >
                <option value="">Select org…</option>
                {data?.orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Role</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={membership.role}
                onChange={(e) => setMembership((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="admin">Admin</option>
                <option value="backoffice">Back Office</option>
                <option value="contractor">Contractor</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save Access
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Organization</h3>
          <form onSubmit={handleOrgSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">Org Name</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="e.g., Pulte Phoenix"
                value={orgForm.name}
                onChange={(e) => setOrgForm({ name: e.target.value })}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              Create Org
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
