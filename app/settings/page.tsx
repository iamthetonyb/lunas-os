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

        {/* Integrations Section */}
        <IntegrationsSection />
      </main>
    </>
  );
}

function IntegrationsSection() {
  const { data: session } = useSession();
  const provider = (session?.user as any)?.provider;

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Integrations</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Google Integration */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-8 h-8" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Google</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Calendar sync &amp; workspace</p>
            </div>
          </div>
          {provider === 'google' ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Connected
              </span>
            </div>
          ) : (
            <a
              href="/api/auth/signin/google"
              onClick={(e) => {
                e.preventDefault();
                import('next-auth/react').then(({ signIn }) => signIn('google'));
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              Connect Google Account
            </a>
          )}
        </div>

        {/* Microsoft Integration */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-8 h-8" viewBox="0 0 23 23" fill="none">
              <path fill="#F25022" d="M0 0h10.97v10.97H0z" />
              <path fill="#00A4EF" d="M12.03 0H23v10.97H12.03z" />
              <path fill="#7FBA00" d="M0 12.03h10.97V23H0z" />
              <path fill="#FFB900" d="M12.03 12.03H23V23H12.03z" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Microsoft</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Outlook calendar &amp; email</p>
            </div>
          </div>
          {provider === 'microsoft' ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Connected
              </span>
            </div>
          ) : (
            <a
              href="/api/auth/signin/microsoft-entra-id"
              onClick={(e) => {
                e.preventDefault();
                import('next-auth/react').then(({ signIn }) => signIn('microsoft-entra-id'));
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              Connect Microsoft Account
            </a>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        Connecting your account enables calendar sync for dispatch events and email notifications.
        Your credentials are stored securely and can be disconnected at any time.
      </p>
    </div>
  );
}
