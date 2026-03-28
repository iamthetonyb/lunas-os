import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Lunas OS',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-6 inline-block">&larr; Back to Login</Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: March 28, 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">1. Introduction</h2>
            <p>Lunas Construction Cleanup (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) respects your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use Lunas OS (&ldquo;the Platform&rdquo;).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">2. Information We Collect</h2>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-3">Personal Information</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name, email address, phone number</li>
              <li>Account credentials (securely hashed)</li>
              <li>Role and organizational affiliation</li>
              <li>Work logs, job requests, and dispatch records</li>
            </ul>

            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-3">Automatically Collected Information</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Device type, browser, and operating system</li>
              <li>IP address and general location</li>
              <li>Usage patterns and feature interactions</li>
              <li>Session timestamps</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">3. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide and maintain the Platform</li>
              <li>Manage user accounts and authentication</li>
              <li>Process job scheduling, dispatch, and invoicing</li>
              <li>Send notifications related to your work (chat messages, approvals, alerts)</li>
              <li>Improve Platform performance and user experience</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">4. Data Sharing</h2>
            <p>We do not sell your personal information. We may share data with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Service providers</strong> — third-party services that help us operate the Platform (hosting, authentication, email delivery)</li>
              <li><strong>Construction partners</strong> — builder superintendents and contacts as necessary for job coordination</li>
              <li><strong>Legal requirements</strong> — when required by law, subpoena, or government request</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">5. Data Storage &amp; Security</h2>
            <p>Your data is stored using industry-standard cloud infrastructure with encryption in transit and at rest. We implement access controls, audit logging, and regular security reviews. While no system is 100% secure, we take reasonable measures to protect your information.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">6. Data Retention</h2>
            <p>We retain your data for as long as your account is active or as needed to provide services. Work records may be retained for legal and accounting purposes. Chat notifications are automatically purged after 90 days. You may request deletion of your account and associated data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact us at the email below.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">8. Cookies &amp; Tracking</h2>
            <p>The Platform uses essential cookies for authentication and session management. We do not use advertising or tracking cookies. Third-party authentication providers (Clerk, Google) may set their own cookies as described in their respective privacy policies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">9. Children&apos;s Privacy</h2>
            <p>The Platform is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy periodically. We will notify you of material changes via the Platform or email. Continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">11. Contact</h2>
            <p>For privacy questions or data requests, contact us at <a href="mailto:info@lunasconstruction.com" className="text-blue-600 dark:text-blue-400 hover:underline">info@lunasconstruction.com</a>.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-slate-700 text-center text-xs text-gray-400 dark:text-gray-500">
          <Link href="/terms" className="text-blue-500 hover:underline">Terms &amp; Conditions</Link>
          <span className="mx-2">|</span>
          <Link href="/login" className="text-blue-500 hover:underline">Back to Login</Link>
        </div>
      </div>
    </main>
  );
}
