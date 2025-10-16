'use client';

import { AppLayout } from '@/components/app-layout';
import { PageHeader } from '@/components/page-header';
import Link from 'next/link';

export default function DashboardPage() {
  const stats = [
    { name: 'Active Jobs', value: '12', change: '+2', icon: '📋', color: 'blue' },
    { name: 'Pending Intakes', value: '8', change: '+3', icon: '📝', color: 'yellow' },
    { name: 'Scheduled Today', value: '5', change: '0', icon: '📅', color: 'green' },
    { name: 'Invoices Due', value: '$12,450', change: '+5%', icon: '💰', color: 'purple' },
  ];

  const quickActions = [
    { name: 'New Intake', href: '/intake/new', icon: '➕', color: 'blue' },
    { name: 'View Schedule', href: '/schedule', icon: '📅', color: 'green' },
    { name: 'Dispatch Jobs', href: '/dispatch', icon: '🚚', color: 'orange' },
    { name: 'Create Invoice', href: '/invoicing', icon: '💰', color: 'purple' },
  ];

  const recentActivity = [
    { type: 'Intake', message: 'New intake submitted for Project ABC', time: '5 min ago' },
    { type: 'Schedule', message: 'Job scheduled for tomorrow', time: '15 min ago' },
    { type: 'Dispatch', message: 'Crew dispatched to Site XYZ', time: '1 hour ago' },
    { type: 'Invoice', message: 'Invoice #1234 sent', time: '2 hours ago' },
  ];

  return (
    <AppLayout>
      <PageHeader 
        title="Dashboard" 
        description="Welcome to Lunas OS - Construction Cleanup Management"
      />

      <main className="px-6 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{stat.icon}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${
                  stat.change.startsWith('+') ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {stat.change}
                </span>
              </div>
              <h3 className="text-sm font-medium text-gray-600">{stat.name}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.name}
                    href={action.href}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
                  >
                    <span className="text-2xl">{action.icon}</span>
                    <span className="font-medium text-gray-700">{action.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-blue-600">{activity.type}</span>
                        <span className="text-xs text-gray-500">{activity.time}</span>
                      </div>
                      <p className="text-sm text-gray-700">{activity.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Module Links */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Modules</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { name: 'Intake', href: '/intake', icon: '📝', desc: 'New jobs' },
              { name: 'Schedule', href: '/schedule', icon: '📅', desc: 'Job calendar' },
              { name: 'Dispatch', href: '/dispatch', icon: '🚚', desc: 'Crew management' },
              { name: 'Blue Book', href: '/blue-book', icon: '📘', desc: 'Project info' },
              { name: 'Contracts', href: '/contracts', icon: '📄', desc: 'Agreements' },
              { name: 'Invoicing', href: '/invoicing', icon: '💰', desc: 'Billing' },
              { name: 'Import', href: '/import', icon: '📥', desc: 'Data import' },
              { name: 'Users', href: '/users', icon: '👥', desc: 'Team' },
              { name: 'Settings', href: '/settings', icon: '⚙️', desc: 'Config' },
            ].map((module) => (
              <Link
                key={module.name}
                href={module.href}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow text-center"
              >
                <div className="text-3xl mb-2">{module.icon}</div>
                <h3 className="font-semibold text-gray-900 text-sm">{module.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{module.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
