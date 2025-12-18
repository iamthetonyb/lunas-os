'use client';

import { PageHeader } from '@/components/page-header';
import { useState, Fragment } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Dialog, Transition } from '@headlessui/react';

type UserFormData = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

function UserModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: any | null;
}) {
  const isEdit = !!user;
  const createUserMutation = useMutation(api.mutations.createUser);
  const updateUserMutation = useMutation(api.mutations.updateUser);

  const [formData, setFormData] = useState<UserFormData>({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
    confirmPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: keyof UserFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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

    setIsSubmitting(true);
    try {
      if (isEdit) {
        await updateUserMutation({
          userId: user.id,
          name: formData.name,
          phone: formData.phone || undefined,
        });
      } else {
        await createUserMutation({
          email: formData.email,
          name: formData.name,
          phone: formData.phone || undefined,
          role: 'FOREMAN',
        });
      }
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="john@example.com"
                      disabled={isEdit}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="555-1234"
                    />
                  </div>

                  {!isEdit && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => handleChange('password', e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="••••••••"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                        <input
                          type="password"
                          value={formData.confirmPassword}
                          onChange={(e) => handleChange('confirmPassword', e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="••••••••"
                        />
                      </div>
                    </>
                  )}

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
  // Real-time Convex queries
  const users = useQuery(api.queries.getUsers);
  const orgs = useQuery(api.queries.getOrgs);

  // Mutations
  const deleteUserMutation = useMutation(api.mutations.deleteUser);
  const createOrgMutation = useMutation(api.mutations.createOrg);
  const deleteOrgMutation = useMutation(api.mutations.deleteOrg);
  const updateOrgMutation = useMutation(api.mutations.updateOrg);
  const assignMembershipMutation = useMutation(api.mutations.assignOrgMembership);

  // Local state
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [membership, setMembership] = useState<{
    userId: string;
    orgId: string;
    role: string;
  }>({ userId: '', orgId: '', role: 'contractor' });
  const [orgForm, setOrgForm] = useState({ name: '' });
  const [busy, setBusy] = useState(false);

  const handleDeleteUser = async (userId: Id<"users">, userName: string | null) => {
    if (!confirm(`Delete user "${userName || 'Unknown'}"? This cannot be undone.`)) return;
    try {
      await deleteUserMutation({ userId });
    } catch (err) {
      console.error(err);
      alert('Failed to delete user.');
    }
  };

  const handleMembershipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membership.userId || !membership.orgId) return;
    setBusy(true);
    try {
      await assignMembershipMutation({
        userId: membership.userId as Id<"users">,
        orgId: membership.orgId as Id<"orgs">,
        role: membership.role,
      });
      alert('Membership saved.');
    } catch (err) {
      console.error(err);
      alert('Failed to save membership.');
    } finally {
      setBusy(false);
    }
  };

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgForm.name.trim()) return;
    setBusy(true);
    try {
      await createOrgMutation({ name: orgForm.name });
      setOrgForm({ name: '' });
    } catch (err) {
      console.error(err);
      alert('Failed to create org.');
    } finally {
      setBusy(false);
    }
  };

  if (!users || !orgs) {
    return (
      <>
        <PageHeader title="Users" description="Loading..." />
        <main className="px-6 py-6">
          <div className="animate-pulse bg-gray-100 rounded-lg h-64"></div>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage system users and permissions (Real-time)"
        action={
          <button
            onClick={() => { setEditingUser(null); setUserModalOpen(true); }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Create User
          </button>
        }
      />
      <main className="px-6 py-6 space-y-6">
        {/* Users Table */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Users</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">Name</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">Email</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">Phone</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">Role</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">Memberships</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 text-gray-900">{user.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-900">{user.email}</td>
                    <td className="px-4 py-3 text-gray-900">{user.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-900">
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100">{user.systemRole}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {user.memberships.length === 0 ? (
                        <span className="text-xs text-gray-500">No org access</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {user.memberships.map((m: any) => (
                            <span
                              key={`${user.id}-${m.orgId}`}
                              className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                            >
                              {m.orgName} · {m.role}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setEditingUser(user); setUserModalOpen(true); }}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id as Id<"users">, user.name)}
                          className="text-red-600 hover:text-red-800 font-medium text-sm"
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
        </section>

        {/* Assign Org Role */}
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
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name || user.email}</option>
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
                {orgs.map((org) => (
                  <option key={org._id} value={org._id}>{org.name}</option>
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
                disabled={busy || !membership.userId || !membership.orgId}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save Access
              </button>
            </div>
          </form>
        </section>

        {/* Create Organization */}
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

        {/* Organizations List */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Organizations</h3>
          {orgs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Slug</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orgs.map((org) => (
                    <tr key={org._id}>
                      <td className="px-4 py-3 text-gray-900 font-medium">{org.name}</td>
                      <td className="px-4 py-3 text-gray-600">{org.slug}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <button
                            onClick={async () => {
                              const newName = prompt('Enter new organization name:', org.name);
                              if (newName && newName !== org.name) {
                                await updateOrgMutation({ orgId: org._id, name: newName });
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Delete organization "${org.name}"?`)) {
                                await deleteOrgMutation({ orgId: org._id });
                              }
                            }}
                            className="text-red-600 hover:text-red-800 font-medium text-sm"
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
          ) : (
            <p className="text-gray-500">No organizations found.</p>
          )}
        </section>
      </main>

      <UserModal
        open={userModalOpen}
        onClose={() => { setUserModalOpen(false); setEditingUser(null); }}
        user={editingUser}
      />
    </>
  );
}
