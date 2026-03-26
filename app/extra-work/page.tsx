'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useConvexUser } from '@/hooks/useConvexUser';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { Pagination } from '@/components/ui/pagination';

type JobRequest = {
  id: string;
  dueDate?: string;
  serviceDate?: string;
  builderName: string | null;
  communityName: string | null;
  lot?: string;
  address?: string;
  notes?: string;
  amount?: string;
  poNumber?: string;
  awrNumber?: string;
  superintendent?: string;
  requestedBy?: string;
  requestedByEmail?: string;
  invoiceNumber?: string;
  status?: string;
  isExtraWork?: boolean;
  services: { id: string; name?: string; serviceName?: string }[];
  createdAt: number;
};

const STATUS_OPTIONS = [
  { value: 'PENDING', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'APPROVED', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'COMPLETED', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'BILLED', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'PAID', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
];

export default function ExtraWorkPage() {
  const { t } = useTranslation();
  const { data: session } = useConvexUser();
  const router = useRouter();
  const isContractor = session?.user?.role === 'FOREMAN' || session?.user?.role === 'CREW';

  const callerUserId = session?.user?.id as Id<"users"> | undefined;
  const jobs = useQuery(api.jobRequests.list, { isExtraWork: true, callerUserId }) as JobRequest[] | undefined;
  const isLoading = jobs === undefined;

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const pageSize = 25;

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    let result = jobs;
    if (statusFilter !== 'ALL') {
      result = result.filter((j) => j.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((j) =>
        (j.builderName ?? '').toLowerCase().includes(q) ||
        (j.communityName ?? '').toLowerCase().includes(q) ||
        (j.lot ?? '').toLowerCase().includes(q) ||
        (j.awrNumber ?? '').toLowerCase().includes(q) ||
        (j.requestedBy ?? '').toLowerCase().includes(q) ||
        (j.invoiceNumber ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [jobs, statusFilter, searchQuery]);

  const total = filteredJobs.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredJobs.slice(start, start + pageSize);
  }, [filteredJobs, page]);

  // Reset to page 1 when filters change
  const handleFilterChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  const updateJobRequest = useMutation(api.jobRequests.update);

  // Status counts for filter pills
  const statusCounts = useMemo(() => {
    if (!jobs) return {};
    const counts: Record<string, number> = { ALL: jobs.length };
    for (const j of jobs) {
      const s = j.status ?? 'PENDING';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [jobs]);

  // O(n) duplicate detection
  const duplicateKeys = useMemo(() => {
    if (!jobs) return new Set<string>();
    const counts = new Map<string, number>();
    for (const job of jobs) {
      const key = `${job.communityName}:${job.lot}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const dupes = new Set<string>();
    for (const [key, count] of counts) {
      if (count > 1) dupes.add(key);
    }
    return dupes;
  }, [jobs]);

  if (isContractor) {
    return (
      <main className="px-6 py-6 space-y-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-400 mb-2">{t('extraWork.accessRestricted')}</h2>
          <p className="text-yellow-700 dark:text-yellow-500">{t('extraWork.accessRestrictedMessage')}</p>
        </div>
      </main>
    );
  }

  const handleUpdate = async (id: string, field: string, value: any) => {
    try {
      await updateJobRequest({ id: id as any, [field]: value });
    } catch (e) {
      console.error('Update failed:', e);
    }
  };

  return (
    <main className="px-4 sm:px-6 py-4 sm:py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('extraWork.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('extraWork.description')}
            {total > 0 && <span className="ml-2 font-medium text-gray-700 dark:text-gray-300">({total} {t('extraWork.records', 'records')})</span>}
          </p>
        </div>
        <button
          onClick={() => router.push('/intake/new?extraWork=true')}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5 min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('extraWork.newExtraWork', 'New Extra Work')}
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status filter pills */}
        <div className="flex gap-1 flex-wrap">
          {['ALL', ...STATUS_OPTIONS.map(s => s.value)].map((status) => (
            <button
              key={status}
              onClick={() => handleFilterChange(status)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === status
                  ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              {status === 'ALL' ? t('chat.filterAll', 'All') : t(`status.${status.toLowerCase()}`, status)}
              {statusCounts[status] !== undefined && (
                <span className="ml-1 text-[10px] opacity-70">({statusCounts[status]})</span>
              )}
            </button>
          ))}
        </div>
        {/* Search */}
        <div className="flex-1 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder={t('extraWork.searchPlaceholder', 'Search AWR#, builder, community, lot...')}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('common.status')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('extraWork.reqDate', 'Req Date')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('extraWork.serviceDate', 'Service Date')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('extraWork.super', 'Super')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('extraWork.awrNumber', 'AWR #')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('common.builder')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('common.community')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('common.lot')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('extraWork.requestedBy', 'Requested By')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('common.email')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('common.service')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('extraWork.total', 'Total')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('extraWork.poNumber', 'PO#')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('extraWork.invoiceNum', 'Invoice #')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {isLoading && (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</td></tr>
              )}
              {!isLoading && filteredJobs.length === 0 && (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">{t('extraWork.noExtraWork')}</td></tr>
              )}
              {paginatedJobs.map((job) => {
                const isDuplicate = duplicateKeys.has(`${job.communityName}:${job.lot}`);
                const statusDef = STATUS_OPTIONS.find(s => s.value === (job.status ?? 'PENDING'));

                return (
                  <tr key={job.id} className={isDuplicate ? "bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20" : "hover:bg-gray-50 dark:hover:bg-slate-800"}>
                    {/* Status */}
                    <td className="px-3 py-2.5">
                      <select
                        defaultValue={job.status || 'PENDING'}
                        className={`px-2 py-1 rounded-full text-[11px] font-semibold border-0 cursor-pointer ${statusDef?.color ?? 'bg-gray-100 text-gray-800'}`}
                        onChange={(e) => handleUpdate(job.id, 'status', e.target.value)}
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s.value} value={s.value}>{t(`status.${s.value.toLowerCase()}`, s.value)}</option>
                        ))}
                      </select>
                    </td>
                    {/* Req Date (creation date) */}
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 text-xs whitespace-nowrap">
                      {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '-'}
                    </td>
                    {/* Service Date */}
                    <td className="px-3 py-2.5">
                      <input
                        type="date"
                        defaultValue={job.serviceDate || (job.dueDate ? new Date(job.dueDate).toISOString().split('T')[0] : '')}
                        className="w-full px-1.5 py-1 border border-gray-200 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        onBlur={(e) => handleUpdate(job.id, 'serviceDate', e.target.value)}
                      />
                    </td>
                    {/* Super (Lunas foreman) */}
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        defaultValue={job.superintendent || ''}
                        className="w-24 px-1.5 py-1 border border-gray-200 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        placeholder={t('extraWork.super', 'Super')}
                        onBlur={(e) => handleUpdate(job.id, 'superintendent', e.target.value)}
                      />
                    </td>
                    {/* AWR # */}
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        defaultValue={job.awrNumber || ''}
                        className="w-20 px-1.5 py-1 border border-gray-200 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white font-mono"
                        placeholder="25-0001"
                        onBlur={(e) => handleUpdate(job.id, 'awrNumber', e.target.value)}
                      />
                    </td>
                    {/* Builder */}
                    <td className="px-3 py-2.5 text-gray-900 dark:text-gray-100 text-xs font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {job.builderName ?? '-'}
                        {isDuplicate && <span className="text-[9px] bg-red-500 text-white px-1 rounded">DUP</span>}
                      </div>
                    </td>
                    {/* Community */}
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 text-xs whitespace-nowrap">
                      {job.communityName ?? '-'}
                    </td>
                    {/* Lot */}
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        defaultValue={job.lot || ''}
                        className="w-16 px-1.5 py-1 border border-gray-200 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        onBlur={(e) => handleUpdate(job.id, 'lot', e.target.value)}
                      />
                    </td>
                    {/* Requested By */}
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        defaultValue={job.requestedBy || ''}
                        className="w-24 px-1.5 py-1 border border-gray-200 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        placeholder={t('extraWork.requestedBy', 'Requested By')}
                        onBlur={(e) => handleUpdate(job.id, 'requestedBy', e.target.value)}
                      />
                    </td>
                    {/* Email */}
                    <td className="px-3 py-2.5">
                      <input
                        type="email"
                        defaultValue={job.requestedByEmail || ''}
                        className="w-36 px-1.5 py-1 border border-gray-200 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        placeholder="email@example.com"
                        onBlur={(e) => handleUpdate(job.id, 'requestedByEmail', e.target.value)}
                      />
                    </td>
                    {/* Service */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-0.5">
                        {job.services?.map(s => (
                          <span key={s.id} className="inline-flex rounded-full bg-blue-100 dark:bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:text-blue-400">
                            {s.serviceName || s.name}
                          </span>
                        ))}
                        {(!job.services || job.services.length === 0) && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    {/* Total ($) */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-0.5">
                        <span className="text-[10px] text-gray-400">$</span>
                        <input
                          type="number"
                          defaultValue={job.amount || ''}
                          className="w-20 px-1.5 py-1 border border-gray-200 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                          onBlur={(e) => handleUpdate(job.id, 'amount', e.target.value)}
                        />
                      </div>
                    </td>
                    {/* PO# */}
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        defaultValue={job.poNumber || ''}
                        className="w-24 px-1.5 py-1 border border-gray-200 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white font-mono"
                        placeholder="PO#"
                        onBlur={(e) => handleUpdate(job.id, 'poNumber', e.target.value)}
                      />
                    </td>
                    {/* Invoice # */}
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        defaultValue={job.invoiceNumber || ''}
                        className="w-24 px-1.5 py-1 border border-gray-200 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white font-mono"
                        placeholder="E-60000"
                        onBlur={(e) => handleUpdate(job.id, 'invoiceNumber', e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          noun={t('extraWork.title', 'extra work items')}
        />
      </div>
    </main>
  );
}
