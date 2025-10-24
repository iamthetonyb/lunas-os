'use client';

import { PageHeader } from '@/components/page-header';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

const PAGE_SIZE = 25;

type BlueBookEntry = {
  id: string;
  builderName: string | null;
  builderId: string | null;
  communityName: string | null;
  communityId: string | null;
  lot: string | null;
  serviceName: string | null;
  accountCategoryCode: string | null;
  accountCategoryName: string | null;
  startDate: string | null;
  invoiceNumber: string | null;
  amount: string | null;
  status: string;
  checkNumber: string | null;
  checkDate: string | null;
  checkTotal: string | null;
  isAch: boolean | null;
};

type BlueBookResponse = {
  entries: BlueBookEntry[];
  total: number;
  page: number;
  pageSize: number;
};

const fetcher = async (url: string): Promise<BlueBookResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to load Blue Book entries');
  }
  const data = await res.json();
  if (Array.isArray(data)) {
    return { entries: data, total: data.length, page: 1, pageSize: data.length || PAGE_SIZE };
  }
  return data;
};

function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

type CheckGroup = {
  key: string;
  checkNumber: string;
  checkDate: string | null;
  checkTotal: string | null;
  isAch: boolean | null;
  entries: BlueBookEntry[];
};

export default function BlueBookPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'checkDate' | 'startDate'>('checkDate');
  const [editingEntry, setEditingEntry] = useState<BlueBookEntry | null>(null);
  const [formState, setFormState] = useState({
    lot: '',
    startDate: '',
    status: 'PENDING',
    invoiceNumber: '',
    amount: '',
    accountCategoryName: '',
    accountCategoryCode: '',
    checkNumber: '',
    checkDate: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const debouncedSearch = useDebounce(search);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sort]);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/blue-book?page=${page}&pageSize=${PAGE_SIZE}&sort=${sort}&search=${encodeURIComponent(
      debouncedSearch
    )}`,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false }
  );

  const entries = data?.entries ?? [];
  const total = data?.total ?? entries.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const groups: CheckGroup[] = useMemo(() => {
    const map = new Map<string, CheckGroup>();
    entries.forEach((entry) => {
      const key =
        entry.checkNumber ||
        (entry.invoiceNumber ? `invoice-${entry.invoiceNumber}` : `entry-${entry.id}`);
      if (!map.has(key)) {
        map.set(key, {
          key,
          checkNumber: entry.checkNumber || 'Unknown Check',
          checkDate: entry.checkDate,
          checkTotal: entry.checkTotal,
          isAch: entry.isAch,
          entries: [],
        });
      }
      map.get(key)!.entries.push(entry);
    });
    return Array.from(map.values()).sort((a, b) => {
      const dateA = a.checkDate ? new Date(a.checkDate).getTime() : 0;
      const dateB = b.checkDate ? new Date(b.checkDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [entries]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenGroups(() => {
      const initial: Record<string, boolean> = {};
      groups.slice(0, 3).forEach((group) => {
        initial[group.key] = true;
      });
      return initial;
    });
  }, [groups]);

  useEffect(() => {
    if (editingEntry) {
      setFormState({
        lot: editingEntry.lot || '',
        startDate: editingEntry.startDate || '',
        status: editingEntry.status,
        invoiceNumber: editingEntry.invoiceNumber || '',
        amount: editingEntry.amount ? String(editingEntry.amount) : '',
        accountCategoryName: editingEntry.accountCategoryName || '',
        accountCategoryCode: editingEntry.accountCategoryCode || '',
        checkNumber: editingEntry.checkNumber || '',
        checkDate: editingEntry.checkDate || '',
      });
      setFormError(null);
    }
  }, [editingEntry]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEntry) return;
    setSaving(true);
    setFormError(null);
    try {
      const response = await fetch(`/api/blue-book/${editingEntry.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lot: formState.lot || null,
          startDate: formState.startDate || null,
          status: formState.status,
          invoiceNumber: formState.invoiceNumber || null,
          amount: formState.amount ? Number(formState.amount) : null,
          accountCategoryName: formState.accountCategoryName || null,
          accountCategoryCode: formState.accountCategoryCode || null,
          checkNumber: formState.checkNumber || null,
          checkDate: formState.checkDate || null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to save changes');
      }
      await mutate();
      setEditingEntry(null);
    } catch (err: any) {
      setFormError(err?.message || 'Unexpected error');
    } finally {
      setSaving(false);
    }
  };

  if (error) return (
    <>
      <PageHeader title="Blue Book" description="Project tracking and management" />
      <main className="px-6 py-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">Failed to load data</p>
        </div>
      </main>
    </>
  );

  return (
    <>
      <PageHeader title="Blue Book" description="Project tracking and management" />
      <main className="px-6 py-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by lot, invoice, category, or check #"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-900 dark:text-white"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'checkDate' | 'startDate')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-900 dark:text-white"
          >
            <option value="checkDate">Sort by Check Date</option>
            <option value="startDate">Sort by Start Date</option>
          </select>
        </div>

        {isLoading && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
            <p className="text-gray-600 dark:text-gray-400">Loading entries…</p>
          </div>
        )}

        {!isLoading && groups.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
            <p className="text-gray-600 dark:text-gray-400">No entries match your criteria.</p>
          </div>
        )}

        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.key} className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <button
                className="flex w-full items-center justify-between px-4 py-3"
                onClick={() => toggleGroup(group.key)}
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Check {group.checkNumber || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {group.checkDate ? new Date(group.checkDate).toLocaleDateString() : 'No check date'}
                    {group.isAch ? ' · ACH' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                  <span>{group.checkTotal ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(group.checkTotal)) : '—'}</span>
                  <span>{openGroups[group.key] ? '▲' : '▼'}</span>
                </div>
              </button>
              {openGroups[group.key] && (
                <div className="overflow-x-auto border-t border-gray-200 dark:border-slate-700">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-900">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Community / Builder</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Lot / Job</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Category</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Start Date</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Invoice</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Amount</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                      {group.entries
                        .slice()
                        .sort((a, b) => {
                          const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
                          const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
                          return bStart - aStart;
                        })
                        .map((entry) => (
                          <tr key={entry.id}>
                            <td className="px-4 py-3 text-gray-900 dark:text-white">
                              <div className="font-medium">{entry.communityName || '—'}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {entry.builderName || entry.builderId || '—'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-900 dark:text-white">
                              {entry.lot || '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-900 dark:text-white">
                              {entry.accountCategoryCode
                                ? `${entry.accountCategoryCode} – ${entry.accountCategoryName || ''}`.trim()
                                : entry.serviceName || '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-900 dark:text-white">
                              {entry.startDate ? new Date(entry.startDate).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-900 dark:text-white">
                              {entry.invoiceNumber || '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-900 dark:text-white">
                              {entry.amount
                                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                                    Number(entry.amount)
                                  )
                                : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                  entry.status === 'COMPLETE'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                }`}
                              >
                                {entry.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                onClick={() => setEditingEntry(entry)}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200">
          <span>
            Page {page} of {totalPages} · {total} total entries
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!canPrev}
              className="rounded-lg border border-gray-300 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => (canNext ? p + 1 : p))}
              disabled={!canNext}
              className="rounded-lg border border-gray-300 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
            >
              Next
            </button>
          </div>
        </div>
      </main>

      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Entry</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Check {editingEntry.checkNumber || 'N/A'} · Invoice {editingEntry.invoiceNumber || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setEditingEntry(null)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                Close
              </button>
            </div>
            <form className="space-y-4 text-sm" onSubmit={handleSave}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-gray-600 dark:text-gray-300">Lot</span>
                  <input
                    className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                    value={formState.lot}
                    onChange={(e) => setFormState((prev) => ({ ...prev, lot: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-gray-600 dark:text-gray-300">Start Date</span>
                  <input
                    type="date"
                    className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                    value={formState.startDate}
                    onChange={(e) => setFormState((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-gray-600 dark:text-gray-300">Status</span>
                  <select
                    className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                    value={formState.status}
                    onChange={(e) => setFormState((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="COMPLETE">Complete</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-gray-600 dark:text-gray-300">Amount</span>
                  <input
                    type="number"
                    step="0.01"
                    className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                    value={formState.amount}
                    onChange={(e) => setFormState((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-gray-600 dark:text-gray-300">Invoice #</span>
                  <input
                    className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                    value={formState.invoiceNumber}
                    onChange={(e) => setFormState((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-gray-600 dark:text-gray-300">Check #</span>
                  <input
                    className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                    value={formState.checkNumber}
                    onChange={(e) => setFormState((prev) => ({ ...prev, checkNumber: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-gray-600 dark:text-gray-300">Check Date</span>
                  <input
                    type="date"
                    className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                    value={formState.checkDate}
                    onChange={(e) => setFormState((prev) => ({ ...prev, checkDate: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-gray-600 dark:text-gray-300">Account Category</span>
                  <input
                    className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                    value={formState.accountCategoryName}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, accountCategoryName: e.target.value }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-gray-600 dark:text-gray-300">Category Code</span>
                  <input
                    className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                    value={formState.accountCategoryCode}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, accountCategoryCode: e.target.value }))
                    }
                  />
                </label>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-slate-600"
                  onClick={() => setEditingEntry(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
