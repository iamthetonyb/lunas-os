'use client';

import { PageHeader } from '@/components/page-header';
import { useState, Fragment, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Dialog, Transition } from '@headlessui/react';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { toast } from 'sonner';
import { Pagination } from '@/components/ui/pagination';
import { PermissionsEditor, parsePermissions, getDefaultPermissions, type PermissionsState } from '@/components/permissions-editor';

type AdminUser = {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  systemRole: string;
  preferredContactMethod?: string;
  permissions?: string;
  memberships: { orgId: string; orgName: string; role: string }[];
};

type Org = {
  id: string;
  name: string;
  slug: string;
};

type UserFormData = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  preferredContactMethod: 'email' | 'call' | 'text';
  role: string;
};

const SYSTEM_ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'BACKOFFICE', label: 'Back Office' },
  { value: 'FOREMAN', label: 'Foreman' },
  { value: 'CREW', label: 'Crew' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'MEMBER', label: 'Member' },
];

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
  const { t } = useTranslation();
  const isEdit = !!user;
  const createUser = useMutation(api.mutations.createUser);
  const updateUser = useMutation(api.mutations.updateUser);

  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    preferredContactMethod: 'email',
    role: 'MEMBER',
  });
  const [permissions, setPermissions] = useState<PermissionsState>(() => getDefaultPermissions('MEMBER'));
  const [activeTab, setActiveTab] = useState<'info' | 'permissions'>('info');

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      const role = user.systemRole || 'MEMBER';
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        password: '',
        confirmPassword: '',
        preferredContactMethod: (user.preferredContactMethod as any) || 'email',
        role,
      });
      setPermissions(parsePermissions(user.permissions, role));
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        preferredContactMethod: 'email',
        role: 'MEMBER',
      });
      setPermissions(getDefaultPermissions('MEMBER'));
    }
    setActiveTab('info');
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
      if (isEdit) {
        // Update Convex user
        await updateUser({
          userId: user.id as Id<"users">,
          name: formData.name,
          phone: formData.phone || undefined,
          role: formData.role,
          permissions: JSON.stringify(permissions),
        });
        // Update Clerk password if changed
        if (formData.password) {
          const res = await fetch('/api/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.email, password: formData.password }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to update password in auth system');
          }
        }
      } else {
        // Create Clerk account first (so they can actually log in)
        const nameParts = formData.name.trim().split(' ');
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            firstName: nameParts[0] || formData.name,
            lastName: nameParts.slice(1).join(' ') || '',
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create auth account');
        }

        // Then create Convex user
        await createUser({
          email: formData.email,
          name: formData.name,
          phone: formData.phone || undefined,
          role: formData.role,
          permissions: JSON.stringify(permissions),
        });
      }

      toast.success(isEdit ? 'User updated' : 'User created — they can now log in');
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
                  {isEdit ? t('users.editUser') : t('users.createNewUser')}
                </Dialog.Title>

                {/* Tabs: User Info / Permissions */}
                <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('info')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'info'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t('users.userInfo', 'User Info')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('permissions')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'permissions'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t('users.rolesPermissions', 'Roles & Permissions')}
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
                      {error}
                    </div>
                  )}

                  {activeTab === 'info' ? (
                    <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('common.name')} *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('common.email')} *
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('common.phone')}
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('common.role')} *
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => {
                        handleChange('role', e.target.value);
                        setPermissions(getDefaultPermissions(e.target.value));
                      }}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    >
                      {SYSTEM_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('settings.preferredContact')}
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {isEdit ? t('users.newPassword') : `${t('common.password')} *`}
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      placeholder="••••••••"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('users.confirmPassword')}
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleChange('confirmPassword', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      placeholder="••••••••"
                    />
                  </div>
                    </>
                  ) : (
                    /* Permissions tab */
                    <PermissionsEditor
                      value={permissions}
                      onChange={setPermissions}
                      role={formData.role}
                    />
                  )}

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      disabled={isSubmitting}
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSubmitting ? t('users.saving') : isEdit ? t('settings.saveChanges') : t('users.createUser')}
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
  const { t } = useTranslation();
  const data = useQuery(api.userFunctions.listWithOrgs, {});
  const isLoading = data === undefined;

  const assignOrgMembership = useMutation(api.mutations.assignOrgMembership);
  const createOrg = useMutation(api.mutations.createOrg);
  const updateOrg = useMutation(api.mutations.updateOrg);
  const deleteOrg = useMutation(api.mutations.deleteOrg);

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
  const deleteUser = useMutation(api.mutations.deleteUser);
  const [confirmDialog, setConfirmDialog] = useState<{title: string; message: string; onConfirm: () => void} | null>(null);

  const sortedUsers = useMemo(() => {
    if (!data?.users) return [];
    return [...data.users].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [data?.users]);

  const [userPage, setUserPage] = useState(1);
  const userPageSize = 20;
  const userTotal = sortedUsers.length;
  const userTotalPages = Math.ceil(userTotal / userPageSize);
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * userPageSize;
    return sortedUsers.slice(start, start + userPageSize);
  }, [sortedUsers, userPage]);

  const handleMembershipSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!membership.userId || !membership.orgId) return;

    console.log('Submitting membership data:', membership); // Log payload to browser console

    setBusy(true);
    try {
      await assignOrgMembership({
        userId: membership.userId as Id<"users">,
        orgId: membership.orgId as Id<"orgs">,
        role: membership.role,
      });
      toast.success('Membership saved.');
    } catch (err: any) {
      console.error('Membership submit failed:', err);
      const errorMsg = err.message || 'Failed to update membership.';
      toast.error(errorMsg);
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
        await updateOrg({
          orgId: editingOrg.id as Id<"orgs">,
          name: orgForm.name,
        });
        toast.success('Organization updated.');
      } else {
        await createOrg({ name: orgForm.name });
        toast.success('Organization created.');
      }
      setOrgForm({ name: '' });
      setEditingOrg(null);
      setOrgModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save organization.');
    } finally {
      setBusy(false);
    }
  };

  const handleEditOrg = (org: Org) => {
    setEditingOrg(org);
    setOrgForm({ name: org.name });
    setOrgModalOpen(true);
  };

  const handleDeleteOrg = (orgId: string) => {
    setConfirmDialog({
      title: 'Delete Organization',
      message: 'Are you sure you want to delete this organization? This will NOT delete associated users, but will remove their access to this org.',
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteOrg({ orgId: orgId as Id<"orgs"> });
          toast.success('Organization deleted.');
        } catch (err) {
          console.error(err);
          toast.error('Failed to delete organization.');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setUserModalOpen(true);
  };

  const handleEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setUserModalOpen(true);
  };

  const handleDeleteUser = (user: AdminUser) => {
    setConfirmDialog({
      title: 'Delete User',
      message: `Are you sure you want to delete ${user.name || user.email}? This will remove their account from both the app and auth system.`,
      onConfirm: async () => {
        try {
          // Delete from Clerk first
          await fetch(`/api/users?email=${encodeURIComponent(user.email)}`, { method: 'DELETE' });
          // Then delete from Convex (memberships + user record)
          await deleteUser({ userId: user.id as Id<"users"> });
          toast.success('User deleted');
        } catch (err: any) {
          console.error(err);
          toast.error(err.message || 'Failed to delete user');
        }
      },
    });
  };

  const handleUserModalClose = () => {
    setUserModalOpen(false);
    setEditingUser(null);
  };

  return (
    <>
      <PageHeader
        title={t('users.title')}
        description={t('users.description')}
        action={
          <button
            onClick={handleCreateUser}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + {t('users.createUser')}
          </button>
        }
      />
      <main className="px-6 py-6 space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('users.currentUsers')}</h3>
          {isLoading && <p className="text-gray-600">{t('common.loading')}</p>}
          {!isLoading && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">{t('common.name')}</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">{t('common.email')}</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">{t('common.role')}</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">{t('users.memberships')}</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{user.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.systemRole === 'ADMIN' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                          user.systemRole === 'BACKOFFICE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                          user.systemRole === 'FOREMAN' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {user.systemRole}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {user.memberships.length === 0 ? (
                          <span className="text-xs text-gray-500">{t('users.noOrgAccess')}</span>
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
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="text-red-500 hover:text-red-700 font-medium text-sm"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={userPage}
                totalPages={userTotalPages}
                total={userTotal}
                pageSize={userPageSize}
                onPageChange={setUserPage}
                noun={t('users.title', 'users')}
              />
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('users.assignOrgRole')}</h3>
          <form onSubmit={handleMembershipSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-gray-700">{t('users.user')}</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={membership.userId}
                onChange={(e) => setMembership((prev) => ({ ...prev, userId: e.target.value }))}
              >
                <option value="">{t('users.selectUser')}</option>
                {sortedUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">{t('users.organization')}</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={membership.orgId}
                onChange={(e) => setMembership((prev) => ({ ...prev, orgId: e.target.value }))}
              >
                <option value="">{t('users.selectOrg')}</option>
                {data?.orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">{t('common.role')}</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={membership.role}
                onChange={(e) => setMembership((prev) => ({ ...prev, role: e.target.value as 'admin' | 'backoffice' | 'contractor' }))}
              >
                <option value="admin">{t('users.admin')}</option>
                <option value="backoffice">{t('users.backOffice')}</option>
                <option value="contractor">{t('users.contractor')}</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={busy || !membership.userId || !membership.orgId}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {t('users.saveAccess')}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('users.organizations')}</h3>
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">{t('common.name')}</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">{t('users.slug')}</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-500">{t('common.actions')}</th>
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
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => handleDeleteOrg(org.id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="text-md font-semibold text-gray-900 mb-4">
            {editingOrg ? t('users.editOrganization') : t('users.createOrganization')}
          </h4>
          <form onSubmit={handleOrgSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">{t('users.orgName')}</label>
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
                {editingOrg ? t('users.updateOrg') : t('users.createOrg')}
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
                  {t('common.cancel')}
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
          toast.success(editingUser ? 'User updated successfully!' : 'User created successfully!');
        }}
      />

      <ConfirmationDialog
        isOpen={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        onConfirm={confirmDialog?.onConfirm ?? (() => {})}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
