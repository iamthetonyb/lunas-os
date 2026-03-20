'use client';
import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/dashboard';
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
        callbackUrl
      });

      console.log('Sign-in result:', res); // Debug log

      if (res?.error) {
        // NextAuth returns error string if auth failed
        alert(t('login.invalidCredentials'));
        setIsLoading(false);
        return;
      }

      if (res?.ok) {
        router.push(callbackUrl);
      } else {
        alert(t('login.invalidCredentials'));
      }
    } catch (err) {
      console.error('Login error:', err);
      alert(t('login.error'));
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: string) => {
    setOauthLoading(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      alert('OAuth sign-in failed. Please try again.');
      setOauthLoading(null);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">{t('login.title')}</h1>
            <p className="text-gray-600 mt-2">{t('login.subtitle')}</p>
          </div>

          <form
            id="login-form"
            data-testid="login-form"
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('login.emailLabel')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder={t('login.emailPlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || oauthLoading !== null}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('login.passwordLabel')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder={t('login.passwordPlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || oauthLoading !== null}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || oauthLoading !== null}
            >
              {isLoading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => router.push('/forgot-password')}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              {t('login.forgotPassword')}
            </button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">{t('login.orContinueWith')}</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleOAuthSignIn('google')}
                disabled={isLoading || oauthLoading !== null}
                className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {oauthLoading === 'google' ? 'Loading...' : 'Google'}
              </button>

              <button
                type="button"
                onClick={() => handleOAuthSignIn('microsoft-entra-id')}
                disabled={isLoading || oauthLoading !== null}
                className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 23 23" fill="none">
                  <path fill="#F25022" d="M0 0h10.97v10.97H0z" />
                  <path fill="#00A4EF" d="M12.03 0H23v10.97H12.03z" />
                  <path fill="#7FBA00" d="M0 12.03h10.97V23H0z" />
                  <path fill="#FFB900" d="M12.03 12.03H23V23H12.03z" />
                </svg>
                {oauthLoading === 'microsoft-entra-id' ? 'Loading...' : 'Microsoft'}
              </button>
            </div>
          </div>


        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="text-center">Loading...</div>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}