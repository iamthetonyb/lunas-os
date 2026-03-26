'use client';

import { useState } from 'react';
import { Navigation } from './navigation';
import { NotificationBell } from './notification-bell';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar Navigation — hidden on mobile, slide-in when toggled */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-200
        md:relative md:translate-x-0 md:z-auto
        ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Navigation onMobileClose={() => setMobileNavOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top bar — hamburger on mobile + notification bell */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-30">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="md:ml-auto">
            <NotificationBell />
          </div>
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
