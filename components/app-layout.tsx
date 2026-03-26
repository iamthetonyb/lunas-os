'use client';

import { Navigation } from './navigation';
import { NotificationBell } from './notification-bell';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Sidebar Navigation */}
      <Navigation />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top bar with notification bell */}
        <div className="flex items-center justify-end px-4 py-2 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
          <NotificationBell />
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
