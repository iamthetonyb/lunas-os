'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const orgRole = (session?.user as any)?.orgRole;

  const canAccessBlueBook = orgRole === 'admin' || orgRole === 'backoffice';

  // Convex queries (reactive, auto-updating)
  const blueBookData = useQuery(api.blueBook.list, canAccessBlueBook ? {} : 'skip');
  const blueBookEntries = blueBookData?.entries ?? [];

  const recentData = useQuery(api.jobRequests.getRecent, {});
  const intakeList = recentData?.intakes ?? [];

  const dispatchBatches = useQuery(api.queries.getDispatchBatches) ?? [];

  // Contractor assignments
  const isContractor = orgRole === 'contractor' || (session?.user as any)?.role === 'FOREMAN' || (session?.user as any)?.role === 'CREW';
  const userName = session?.user?.name ?? '';
  const myAssignments = useQuery(
    api.userFunctions.getMyAssignments,
    isContractor && userName ? { userName } : 'skip'
  ) ?? [];

  // Calculate dynamic stats (hydration-safe today)
  const activeJobCount = blueBookEntries.filter((e: any) => e.status !== 'COMPLETE').length;
  const pendingIntakeCount = intakeList.length;

  const [today, setToday] = useState('');
  useEffect(() => {
    setToday(new Date().toISOString().split('T')[0]);
  }, []);

  const scheduledTodayCount = dispatchBatches.filter((b: any) => {
    return b.serviceDate === today && b.status === 'SENT';
  }).length;

  const stats = [
    { name: t('dashboard.activeJobs'), value: (activeJobCount ?? 0).toString(), change: (activeJobCount ?? 0) > 0 ? `+${activeJobCount}` : '0', icon: '📋' },
    { name: t('dashboard.pendingIntakes'), value: (pendingIntakeCount ?? 0).toString(), change: (pendingIntakeCount ?? 0) > 0 ? `+${pendingIntakeCount}` : '0', icon: '📝' },
    { name: t('dashboard.scheduledToday'), value: (scheduledTodayCount ?? 0).toString(), change: '0', icon: '📅' },
    { name: t('dashboard.dispatchBatches'), value: (dispatchBatches?.length ?? 0).toString(), change: (dispatchBatches?.length ?? 0) > 0 ? `+${dispatchBatches?.length}` : '0', icon: '🚀' },
  ];

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.description')}
      />

      <main className="px-6 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{stat.icon}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${stat.change.startsWith('+') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
                  }`}>
                  {stat.change}
                </span>
              </div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Blue Book Snapshot and Recent Intakes */}
        <div className={`grid grid-cols-1 ${canAccessBlueBook ? 'lg:grid-cols-3' : ''} gap-6 mb-8`}>
          {canAccessBlueBook && (
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-900 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">{t('dashboard.blueBook')}</h2>
                  <Link
                    href="/blue-book"
                    className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors backdrop-blur-sm"
                  >
                    {t('common.viewAll')}
                  </Link>
                </div>
                <div className="space-y-3">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <p className="text-sm opacity-90 mb-1">{t('dashboard.totalJobs')}</p>
                    <p className="text-3xl font-bold">{blueBookEntries.length}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <p className="text-sm opacity-90 mb-1">{t('dashboard.activeJobs')}</p>
                    <p className="text-2xl font-bold">
                      {blueBookEntries.filter((e: any) => e.status !== 'COMPLETE').length}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <p className="text-sm opacity-90 mb-1">{t('dashboard.completed')}</p>
                    <p className="text-2xl font-bold">
                      {blueBookEntries.filter((e: any) => e.status === 'COMPLETE').length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!canAccessBlueBook && (
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 dark:from-indigo-600 dark:to-indigo-900 rounded-lg shadow-lg p-6 text-white h-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">{t('dashboard.mySchedule')}</h2>
                  <Link
                    href="/schedule"
                    className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors backdrop-blur-sm"
                  >
                    {t('dashboard.viewFullSchedule')}
                  </Link>
                </div>
                {myAssignments.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
                    <p className="text-sm opacity-90">{t('dashboard.noAssignments')}</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                    {myAssignments.slice(0, 5).map((job: any) => (
                      <div key={job.id} className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{job.serviceDate ? new Date(job.serviceDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD'}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${job.status === 'SENT' ? 'bg-green-400/30 text-green-100' : 'bg-white/20'}`}>{job.status}</span>
                        </div>
                        <p className="text-sm font-bold truncate">{job.communityName} · Lot {job.lot}</p>
                        <p className="text-xs opacity-90 truncate">{job.builderName}</p>
                        <p className="text-xs mt-1 italic opacity-80">{job.serviceName}</p>
                      </div>
                    ))}
                    {myAssignments.length > 5 && (
                      <p className="text-[10px] text-center opacity-70 mt-2">{t('dashboard.moreAssignments', { count: myAssignments.length - 5 })}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Intake Submissions */}
          <div className={canAccessBlueBook ? 'lg:col-span-2' : ''}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('dashboard.recentIntakes')}</h2>
              {intakeList.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('dashboard.noIntakes')}
                </p>
              ) : (
                <div className="space-y-4">
                  {intakeList.map((intake: any) => (
                    <div
                      key={intake.id}
                      className="flex flex-col gap-2 pb-4 border-b border-gray-100 dark:border-slate-700 last:pb-0 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {intake.builderName} · {intake.communityName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Lot {intake.lot} &middot;{' '}
                            {intake.services?.length ? intake.services.map((s: any) => s.serviceName ?? s).join(', ') : t('common.servicesPending')}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full">
                          {intake.modelPlanName}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          {t('common.due')}{' '}
                          {intake.dueDate
                            ? new Date(intake.dueDate).toLocaleDateString()
                            : 'TBD'}
                        </span>
                        <span>
                          {t('common.submitted')}{' '}
                          {intake.createdAt
                            ? new Date(intake.createdAt).toLocaleString()
                            : t('common.justNow')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Blue Book Recent Entries Table */}
        {canAccessBlueBook && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.recentBlueBook')}</h2>
              <Link
                href="/blue-book"
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
              >
                {t('common.viewAllEntries')}
              </Link>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              {blueBookEntries.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-5xl mb-3">📘</div>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">{t('dashboard.noBlueBook')}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">{t('dashboard.startTracking')}</p>
                  <Link
                    href="/blue-book"
                    className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    {t('dashboard.createFirstEntry')}
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50 dark:bg-slate-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.builder')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.community')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.lot')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('blueBook.category')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('blueBook.startDate')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.amount')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.status')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                      {blueBookEntries.slice(0, 5).map((entry: any) => {
                        const categoryLabel = entry.accountCategoryCode
                          ? `${entry.accountCategoryCode} - ${entry.accountCategoryName || ''}`.trim()
                          : entry.serviceName || '-';
                        const startDateLabel = entry.startDate
                          ? new Date(entry.startDate).toLocaleDateString()
                          : '-';
                        const amountLabel = entry.amount !== null && entry.amount !== undefined
                          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(entry.amount))
                          : '-';

                        return (
                          <tr key={entry.id} className={entry.status === 'COMPLETE' ? 'bg-green-100/30 dark:bg-green-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {entry.builderName || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {entry.communityName || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {entry.lot || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {categoryLabel}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {startDateLabel}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {amountLabel}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${entry.status === 'COMPLETE'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  }`}
                              >
                                {entry.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
