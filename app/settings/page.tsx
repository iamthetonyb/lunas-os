'use client';

export const dynamic = 'force-dynamic';

import { PageHeader } from '@/components/page-header';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  preferredLang: 'EN' | 'ES_MX';
  preferredContactMethod: 'email' | 'call' | 'text';
};

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id as string | null;
  const profile = useQuery(
    api.userFunctions.getProfile,
    userId ? { userId: userId as Id<"users"> } : "skip"
  ) as UserProfile | undefined;
  const isLoading = userId ? profile === undefined : false;
  const updateProfile = useMutation(api.userFunctions.updateProfile);

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
      // Sync language on load
      const targetLang = profile.preferredLang === 'ES_MX' ? 'es' : 'en';
      if (i18n.language !== targetLang) {
        i18n.changeLanguage(targetLang);
      }
    }
  }, [profile, i18n]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setSuccess('');
    setError('');

    try {
      await updateProfile({
        userId: userId as Id<"users">,
        name: formData.name,
        preferredLang: formData.preferredLang,
        preferredContactMethod: formData.preferredContactMethod,
      });
      setSuccess('Settings saved successfully');

      // Update language immediately
      const newLang = formData.preferredLang === 'ES_MX' ? 'es' : 'en';
      await i18n.changeLanguage(newLang);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <div className="p-8">{t('common.loading')}</div>;

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('settings.generalSettings')}</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('settings.displayName')}
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
                    {t('settings.preferredLanguage')}
                  </label>
                  <select
                    value={formData.preferredLang}
                    onChange={(e) => setFormData({ ...formData, preferredLang: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  >
                    <option value="EN">{t('settings.english')}</option>
                    <option value="ES_MX">{t('settings.spanish')}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('settings.notifications')}</h3>

              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('settings.contactPreference')}
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
              {busy ? t('settings.saving') : t('settings.saveChanges')}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
