'use client';

import type { BlueBookSort } from '@/types/blue-book';

type Props = {
    search: string;
    onSearchChange: (value: string) => void;
    sort: BlueBookSort;
    onSortChange: (value: BlueBookSort) => void;
    startDateFrom: string | null;
    startDateTo: string | null;
    onDateRangeChange: (from: string | null, to: string | null) => void;
    statusFilter: string | null;
    onStatusChange: (value: string | null) => void;
    onReset: () => void;
};

export function BlueBookToolbar({
    search,
    onSearchChange,
    sort,
    onSortChange,
    startDateFrom,
    startDateTo,
    onDateRangeChange,
    statusFilter,
    onStatusChange,
    onReset,
}: Props) {
    return (
        <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search lot, PO, check #..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 transition-colors"
                />
                <svg
                    className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>

            {/* Sort */}
            <select
                value={sort}
                onChange={(e) => onSortChange(e.target.value as BlueBookSort)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-gray-700 dark:text-gray-300"
            >
                <option value="community">Sort: Community</option>
                <option value="startDate">Sort: Start Date</option>
                <option value="checkDate">Sort: Check Date</option>
            </select>

            {/* Status filter */}
            <select
                value={statusFilter ?? ""}
                onChange={(e) => onStatusChange(e.target.value || null)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-gray-700 dark:text-gray-300"
            >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="COMPLETE">Complete</option>
            </select>

            {/* Date range */}
            <div className="flex items-center gap-1">
                <input
                    type="date"
                    value={startDateFrom ?? ""}
                    onChange={(e) => onDateRangeChange(e.target.value || null, startDateTo)}
                    className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-gray-700 dark:text-gray-300"
                    title="From date"
                />
                <span className="text-gray-400 text-xs">to</span>
                <input
                    type="date"
                    value={startDateTo ?? ""}
                    onChange={(e) => onDateRangeChange(startDateFrom, e.target.value || null)}
                    className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-gray-700 dark:text-gray-300"
                    title="To date"
                />
            </div>

            {/* Reset */}
            <button
                onClick={onReset}
                className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
                Reset
            </button>
        </div>
    );
}
