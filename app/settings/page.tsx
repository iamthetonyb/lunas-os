'use client';

import { PageHeader } from '@/components/page-header';
import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { fetchJSON } from '@/lib/utils/fetch-json';

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  preferredLang: 'EN' | 'ES_MX';
  preferredContactMethod: 'email' | 'call' | 'text';
};

export default function SettingsPage() {
  const { data: profile, isLoading } = useSWR<UserProfile>('/api/users/profile', (url) => fetchJSON<UserProfile>(url));
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    preferredLang: 'EN',
    preferredContactMethod: 'email',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        preferredLang: profile.preferredLang || 'EN',
        preferredContactMethod: profile.preferredContactMethod || 'email',
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSuccess('');
    setError('');

    try {
      await fetchJSON('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      setSuccess('Settings saved successfully');
      await mutate('/api/users/profile');
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure your personal preferences and notification settings"
      />
      <main className="px-6 py-6 max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <span>✅</span> {success}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <span>❌</span> {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">General Settings</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Language Preference
                  </label>
                  <select
                    value={formData.preferredLang}
                    onChange={(e) => setFormData({ ...formData, preferredLang: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  >
                    <option value="EN">English</option>
                    <option value="ES_MX">Spanish (Español)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notifications</h3>

              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  How would you prefer to be contacted for job updates and dispatches?
                </p>

                <div className="space-y-2">
                  {['email', 'call', 'text'].map((method) => (
                    <label key={method} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                      <input
                        type="radio"
                        name="preferredContactMethod"
                        checked={formData.preferredContactMethod === method}
                        onChange={() => setFormData({ ...formData, preferredContactMethod: method as any })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-900 dark:text-gray-200 capitalize">{method}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Save All Settings'}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
