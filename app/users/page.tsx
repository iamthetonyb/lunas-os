'use client';

import { PageHeader } from '@/components/page-header';
import useSWR, { mutate } from 'swr';
import { useState, Fragment, useEffect, useMemo } from 'react';
import { fetchJSON } from '@/lib/utils/fetch-json';
import { Dialog, Transition } from '@headlessui/react';

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  systemRole: string | null;
  preferredContactMethod: string | null;
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

type UserFormData = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  preferredContactMethod: 'email' | 'call' | 'text';
};

function UserModal({
  open,
  onClose,
  user,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  user: AdminUser | null;
  onSuccess: () => void;
}) {
  const isEdit = !!user;
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    preferredContactMethod: 'email',
  });

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        password: '',
        confirmPassword: '',
        preferredContactMethod: (user.preferredContactMethod as any) || 'email',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        preferredContactMethod: 'email',
      });
    }
  }, [user, open]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: keyof UserFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    if (!isEdit && !formData.password) {
      setError('Password is required for new users');
      return;
    }
    if (formData.password && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password && formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        preferredContactMethod: formData.preferredContactMethod,
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      if (isEdit) {
        await fetchJSON(`/api/admin/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJSON('/api/admin/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      await mutate('/api/admin/users');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  {isEdit ? 'Edit User' : 'Create New User'}
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      placeholder="555-1234"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Preferred Contact Method
                    </label>
                    <div className="flex gap-4">
                      {['email', 'call', 'text'].map((method) => (
                        <label key={method} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="preferredContactMethod"
                            checked={formData.preferredContactMethod === method}
                            onChange={() => handleChange('preferredContactMethod', method)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{method}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {isEdit ? 'New Password (leave blank to keep current)' : 'Password *'}
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="••••••••"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleChange('confirmPassword', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create User'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default function UsersPage() {
  const { data, isLoading, error } = useSWR<AdminUsersResponse>('/api/admin/users', fetcher);
  const [membership, setMembership] = useState<{
    userId: string;
    orgId: string;
    role: 'admin' | 'backoffice' | 'contractor';
  }>({
    userId: '',
    orgId: '',
    role: 'contractor',
  });
  const [orgForm, setOrgForm] = useState({ name: '' });
  const [busy, setBusy] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Org | null>(null);
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);

  const sortedUsers = useMemo(() => {
    if (!data?.users) return [];
    return [...data.users].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [data?.users]);

  const handleMembershipSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!membership.userId || !membership.orgId) return;

    console.log('Submitting membership data:', membership); // Log payload to browser console

    setBusy(true);
    try {
      await fetchJSON('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(membership),
      });
      await mutate('/api/admin/users');
      alert('Membership saved.');
    } catch (err: any) {
      console.error('Membership submit failed with data:', err.data); // Log full server error.data
      // Handle empty error.data
      if (!err.data || Object.keys(err.data).length === 0) {
        err.data = { error: 'Unknown server error' };
      }
      const errorMsg = err.data?.details
        ? 'Validation failed: ' + JSON.stringify(err.data.details)
        : err.data?.error || err.message || 'Failed to update membership.';
      alert(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  const handleOrgSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgForm.name.trim()) return;
    setBusy(true);
    try {
      if (editingOrg) {
        await fetchJSON(`/api/admin/orgs/${editingOrg.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: orgForm.name }),
        });
        alert('Organization updated.');
      } else {
        await fetchJSON('/api/admin/orgs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: orgForm.name }),
        });
        alert('Organization created.');
      }
      setOrgForm({ name: '' });
      setEditingOrg(null);
      setOrgModalOpen(false);
      await mutate('/api/admin/users');
    } catch (err) {
      console.error(err);
      alert('Failed to save organization.');
    } finally {
      setBusy(false);
    }
  };

  const handleEditOrg = (org: Org) => {
    setEditingOrg(org);
    setOrgForm({ name: org.name });
    setOrgModalOpen(true);
  };

  const handleDeleteOrg = async (orgId: string) => {
    if (!confirm('Are you sure you want to delete this organization? This will NOT delete associated users, but will remove their access to this org.')) return;

    setBusy(true);
    try {
      await fetchJSON(`/api/admin/orgs/${orgId}`, { method: 'DELETE' });
      await mutate('/api/admin/users');
      alert('Organization deleted.');
    } catch (err) {
      console.error(err);
      alert('Failed to delete organization.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setUserModalOpen(true);
  };

  const handleEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setUserModalOpen(true);
  };

  const handleUserModalClose = () => {
    setUserModalOpen(false);
    setEditingUser(null);
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage system users and permissions"
        action={
          <button
            onClick={handleCreateUser}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Create User
          </button>
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
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Phone</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Memberships</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3 text-gray-900">{user.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-900">{user.email}</td>
                      <td className="px-4 py-3 text-gray-900">{user.phone || '—'}</td>
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
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          Edit
                        </button>
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
                onChange={(e) => setMembership((prev) => ({ ...prev, role: e.target.value as 'admin' | 'backoffice' | 'contractor' }))}
              >
                <option value="admin">Admin</option>
                <option value="backoffice">Back Office</option>
                <option value="contractor">Contractor</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={busy || !membership.userId || !membership.orgId}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save Access
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Organizations</h3>
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">Name</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">Slug</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.orgs.map((org) => (
                  <tr key={org.id}>
                    <td className="px-4 py-3 text-gray-900 font-medium">{org.name}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono">{org.slug}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleEditOrg(org)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteOrg(org.id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="text-md font-semibold text-gray-900 mb-4">
            {editingOrg ? 'Edit Organization' : 'Create New Organization'}
          </h4>
          <form onSubmit={handleOrgSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">Org Name</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 bg-white text-gray-900"
                placeholder="e.g., Pulte Phoenix"
                value={orgForm.name}
                onChange={(e) => setOrgForm({ name: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${editingOrg ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
                  }`}
              >
                {editingOrg ? 'Update Org' : 'Create Org'}
              </button>
              {editingOrg && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingOrg(null);
                    setOrgForm({ name: '' });
                  }}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      </main>

      <UserModal
        open={userModalOpen}
        onClose={handleUserModalClose}
        user={editingUser}
        onSuccess={() => {
          alert(editingUser ? 'User updated successfully!' : 'User created successfully!');
        }}
      />
    </>
  );
}
