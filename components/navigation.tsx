'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from '@/lib/theme-provider';
import Image from 'next/image';
import { useEffect, useState } from 'react';

const baseNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Intake', href: '/intake', icon: '📝' },
  { name: 'Work Log', href: '/work-log', icon: '🧾' },
  { name: 'Schedule', href: '/schedule', icon: '📅' },
  { name: 'Dispatch', href: '/dispatch', icon: '🚚' },
  { name: 'Blue Book', href: '/blue-book', icon: '📘' },
  { name: 'Contracts', href: '/contracts', icon: '📄' },
  { name: 'Invoicing', href: '/invoicing', icon: '💰' },
  { name: 'Import', href: '/import', icon: '📥' },
  { name: 'Users', href: '/users', icon: '👥' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
];

export function Navigation() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { data: session } = useSession();
  // Use orgRole from org_members (admin/backoffice/contractor) instead of user role
  const orgRole = session?.user?.orgRole ?? undefined;
  const userRole = session?.user?.role ?? undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Include Dashboard as user specified - contractor is the org role for foremen/contractors
  const contractorAllowed = new Set(['Dashboard', 'Intake', 'Work Log', 'Schedule']);
  const navigation =
    orgRole === 'contractor'
      ? baseNavigation.filter((item) => contractorAllowed.has(item.name))
      : baseNavigation;

  const userDisplayName = session?.user?.name ?? 'User';
  const userRoleLabel = orgRole 
    ? (orgRole === 'backoffice' ? 'Back Office' : orgRole.charAt(0).toUpperCase() + orgRole.slice(1))
    : (userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Team');

  return (
    <nav className="bg-white dark:bg-slate-800 shadow-lg h-screen w-64 flex flex-col overflow-y-auto transition-colors duration-300">
      {/* Logo/Brand */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center mb-2">
          {mounted && (
            <Image 
              src={theme === 'dark' ? '/lunas-dark-logo.png' : '/lunas-light-logo.png'}
              alt="Lunas OS"
              width={120}
              height={40}
              className="h-10 w-auto"
              priority
            />
          )}
          {!mounted && (
            <div className="h-10 w-30 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Construction Cleanup</p>
      </div>

      {/* Navigation Items - Grows to fill space */}
      <div className="px-3 py-4 flex-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 my-1 rounded-lg transition-colors
                ${isActive 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Theme Toggle & User Section - Stays at bottom */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800">
        {/* Theme Toggle */}
        {mounted && (
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              <span className="flex items-center gap-2">
                <span>{theme === 'dark' ? '🌙' : '☀️'}</span>
                <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {theme === 'dark' ? 'On' : 'Off'}
              </span>
            </button>
          </div>
        )}
        
        {/* User Info */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-300 font-semibold">U</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {userDisplayName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{userRoleLabel}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-sm font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
