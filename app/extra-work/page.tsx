'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';

type JobRequest = {
  id: string;
  dueDate?: string;
  builderName: string | null;
  communityName: string | null;
  lot?: string;
  address?: string;
  notes?: string;
  amount?: string;
  poNumber?: string;
  status?: string;
  isExtraWork?: boolean;
  requestedBy?: string;
  services: { id: string; name?: string; serviceName?: string }[];
  createdAt: number;
};

export default function ExtraWorkPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const router = useRouter();
  const isContractor = session?.user?.role === 'FOREMAN' || session?.user?.role === 'CREW';

  // Convex reactive query - no polling needed
  const jobs = useQuery(api.jobRequests.list, { isExtraWork: true }) as JobRequest[] | undefined;
  const isLoading = jobs === undefined;

  // Convex mutation for updates
  const updateJobRequest = useMutation(api.jobRequests.update);

  // O(n) duplicate detection: build a Set of keys that appear more than once
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">{t('extraWork.accessRestricted')}</h2>
          <p className="text-yellow-700">{t('extraWork.accessRestrictedMessage')}</p>
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
    <main className="px-6 py-6 space-y-6">
      {/* ... Header ... */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('extraWork.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('extraWork.description')}</p>
        </div>
        <button
          onClick={() => router.push('/intake/new?extraWork=true')}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Extra Work
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-500">{t('common.due')} {t('common.date')}</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-500">{t('common.builder')} / {t('common.community')}</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-500">{t('common.lot')} / {t('common.address')}</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-500">{t('common.service')}</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-500">{t('extraWork.price')}</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-500">{t('common.notes')}</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-500">{t('common.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">{t('common.loading')}</td></tr>
            )}
            {!isLoading && (!jobs || jobs.length === 0) && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">{t('extraWork.noExtraWork')}</td></tr>
            )}
            {jobs?.map((job) => {
              const isDuplicate = duplicateKeys.has(`${job.communityName}:${job.lot}`);

              return (
                <tr key={job.id} className={isDuplicate ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      defaultValue={job.dueDate ? new Date(job.dueDate).toISOString().split('T')[0] : ''}
                      className="w-full px-2 py-1 border rounded text-xs"
                      onBlur={(e) => handleUpdate(job.id, 'dueDate', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <div className="font-medium flex items-center gap-1">
                      {job.builderName}
                      {isDuplicate && <span className="text-[10px] bg-red-500 text-white px-1 rounded">DUP</span>}
                    </div>
                    <div className="text-xs text-gray-500">{job.communityName}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">{t('common.lot')}:</span>
                        <input
                          type="text"
                          defaultValue={job.lot}
                          className="w-16 px-1 py-0.5 border rounded text-xs"
                          onBlur={(e) => handleUpdate(job.id, 'lot', e.target.value)}
                        />
                      </div>
                      <input
                        type="text"
                        defaultValue={job.address || ''}
                        className="w-full px-1 py-0.5 border rounded text-[10px]"
                        placeholder={t('common.address')}
                        onBlur={(e) => handleUpdate(job.id, 'address', e.target.value)}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <div className="flex flex-wrap gap-1">
                      {job.services?.map(s => (
                        <span key={s.id} className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                          {s.serviceName || s.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">$</span>
                        <input
                          type="number"
                          defaultValue={job.amount || ''}
                          className="w-20 px-1 py-0.5 border rounded text-xs"
                          placeholder={t('extraWork.price')}
                          onBlur={(e) => handleUpdate(job.id, 'amount', e.target.value)}
                        />
                      </div>
                      <input
                        type="text"
                        defaultValue={job.poNumber || ''}
                        className="w-full px-1 py-0.5 border rounded text-[10px]"
                        placeholder={t('blueBook.invoiceNumber')}
                        onBlur={(e) => handleUpdate(job.id, 'poNumber', e.target.value)}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <textarea
                      defaultValue={job.notes || ''}
                      rows={2}
                      className="w-full px-2 py-1 border rounded text-xs resize-none"
                      placeholder={t('common.notes')}
                      onBlur={(e) => handleUpdate(job.id, 'notes', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <select
                      defaultValue={job.status || 'PENDING'}
                      className="w-28 px-1 py-1 border rounded text-xs"
                      onChange={(e) => handleUpdate(job.id, 'status', e.target.value)}
                    >
                      <option value="PENDING">{t('status.pending')}</option>
                      <option value="APPROVED">{t('extraWork.approved')}</option>
                      <option value="COMPLETED">{t('status.completed')}</option>
                      <option value="BILLED">{t('extraWork.billed')}</option>
                      <option value="PAID">{t('invoicing.paid')}</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
