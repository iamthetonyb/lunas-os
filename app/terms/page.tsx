'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

export default function TermsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
  };

  return (
    <main className="min-h-screen bg-white dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      {/* Top-right controls */}
      {mounted && (
        <div className="fixed top-4 right-4 flex gap-2 z-10">
          <button
            onClick={toggleLang}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            {i18n.language === 'es' ? 'EN' : 'ES'}
          </button>
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            {resolvedTheme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-6 inline-block">&larr; Back to Login</Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Terms &amp; Conditions</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: March 28, 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">1. Acceptance of Terms</h2>
            <p>By accessing and using Lunas OS (&ldquo;the Platform&rdquo;), operated by Lunas Construction Cleanup LLC (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), you agree to be bound by these Terms &amp; Conditions. If you do not agree, do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">2. Description of Service</h2>
            <p>Lunas OS is a construction cleanup management platform providing job scheduling, dispatch, work logging, invoicing, team communication, and related operational tools for authorized users of Lunas Construction Cleanup and its partners.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">3. User Accounts</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. We reserve the right to suspend or terminate accounts that violate these terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the Platform for any unlawful purpose</li>
              <li>Share your account credentials with unauthorized parties</li>
              <li>Attempt to gain unauthorized access to any portion of the Platform</li>
              <li>Transmit malicious code or interfere with the Platform&apos;s operation</li>
              <li>Use the Platform to store or transmit content that infringes on third-party rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">5. Intellectual Property</h2>
            <p>All content, features, and functionality of the Platform are owned by Lunas Construction Cleanup LLC and are protected by copyright, trademark, and other intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written consent.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">6. Data &amp; Content</h2>
            <p>You retain ownership of the data you input into the Platform. By using the Platform, you grant us a limited license to process, store, and display your data solely for the purpose of providing the service. We will not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">7. Service Availability</h2>
            <p>We strive to maintain Platform availability but do not guarantee uninterrupted access. We may perform maintenance, updates, or modifications that temporarily affect availability. We are not liable for any losses resulting from downtime.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">8. Limitation of Liability</h2>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, LUNAS CONSTRUCTION CLEANUP LLC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PLATFORM. OUR TOTAL LIABILITY SHALL NOT EXCEED THE FEES PAID BY YOU IN THE TWELVE MONTHS PRECEDING THE CLAIM.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">9. Indemnification</h2>
            <p>You agree to indemnify and hold harmless Lunas Construction Cleanup LLC, its officers, directors, employees, and agents from any claims, damages, or expenses arising from your use of the Platform or violation of these terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">10. Modifications</h2>
            <p>We reserve the right to modify these terms at any time. Continued use of the Platform after changes constitutes acceptance of the modified terms. Material changes will be communicated via the Platform or email.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">11. Governing Law</h2>
            <p>These terms are governed by the laws of the State of Nevada, without regard to conflict of law principles. Any disputes shall be resolved in the courts of Clark County, Nevada.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">12. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:dispatch@lunasinc.com" className="text-blue-600 dark:text-blue-400 hover:underline">dispatch@lunasinc.com</a>.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-slate-700 text-center text-xs text-gray-400 dark:text-gray-500">
          <Link href="/privacy" className="text-blue-500 hover:underline">Privacy Policy</Link>
          <span className="mx-2">|</span>
          <Link href="/login" className="text-blue-500 hover:underline">Back to Login</Link>
        </div>
      </div>
    </main>
  );
}
