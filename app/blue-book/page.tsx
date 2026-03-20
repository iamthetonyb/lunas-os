'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';
import type { BlueBookEntry, PhaseDefinition } from '@/types/blue-book';

import { PageHeader } from '@/components/page-header';
import { QueryWrapper } from '@/components/QueryWrapper';
import { BuilderTabBar } from '@/components/blue-book/BuilderTabBar';
import { BlueBookToolbar } from '@/components/blue-book/BlueBookToolbar';
import { CommunityGroup } from '@/components/blue-book/CommunityGroup';
import { EditEntryModal } from '@/components/blue-book/EditEntryModal';
import { CreateEntryModal } from '@/components/blue-book/CreateEntryModal';
import { PhaseConfigEditor } from '@/components/blue-book/PhaseConfigEditor';
import { BlueBookPagination } from '@/components/blue-book/BlueBookPagination';

import { useBlueBookFilters } from '@/hooks/useBlueBookFilters';
import { usePhaseOverrides } from '@/hooks/usePhaseOverrides';
import { useCommunityGroups } from '@/hooks/useCommunityGroups';

const PAGE_SIZE = 500;

// Default Pulte phases — used as fallback when DB has no phase configs yet
const DEFAULT_PHASES: PhaseDefinition[] = [
    {
        _id: 'default-t3',
        code: '22702',
        title: '22702 – T3',
        shorthand: 'T3',
        serviceNames: ['Frame Sweep'],
        sortOrder: 1,
        active: true,
    },
    {
        _id: 'default-t2',
        code: '22712',
        title: '22712 – T2',
        shorthand: 'T2',
        serviceNames: ['Tubs & Windows', 'Q/A', 'Power Wash'],
        sortOrder: 2,
        active: true,
    },
    {
        _id: 'default-t1',
        code: '22714',
        title: '22714 – T1',
        shorthand: 'T1',
        serviceNames: ['Final Clean', 'Touch up Clean'],
        sortOrder: 3,
        active: true,
    },
];

export default function BlueBookPage() {
    const { data: session } = useSession();
    const {
        filters,
        rawSearch,
        setBuilderId,
        setStatus,
        setSearch,
        setSort,
        setDateRange,
        resetFilters,
    } = useBlueBookFilters();

    const [page, setPage] = useState(1);
    const [editingEntry, setEditingEntry] = useState<BlueBookEntry | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [showPhaseConfig, setShowPhaseConfig] = useState(false);

    // ── Data queries ─────────────────────────────────────────────────
    const builders = useQuery(api.queries.getBuilders, {}) ?? [];

    // Auto-select first builder on mount so entries show immediately
    const [autoSelected, setAutoSelected] = useState(false);
    useEffect(() => {
        if (!autoSelected && builders.length > 0 && !filters.builderId) {
            setBuilderId(builders[0]._id);
            setAutoSelected(true);
        }
    }, [builders, filters.builderId, autoSelected, setBuilderId]);

    const blueBookResult = useQuery(api.blueBook.list, {
        builderId: filters.builderId
            ? (filters.builderId as Id<'builders'>)
            : undefined,
        status: filters.status ?? undefined,
        search: filters.search || undefined,
        page,
        pageSize: PAGE_SIZE,
        sort: filters.sort,
    });

    // Phase definitions for the active builder (or skip if "All Builders")
    const dbPhaseConfigs = useQuery(
        api.blueBookPhases.getByBuilder,
        filters.builderId
            ? { builderId: filters.builderId as Id<'builders'> }
            : 'skip'
    );

    // Fall back to default Pulte phases when DB has no configs
    const phaseConfigs: PhaseDefinition[] =
        dbPhaseConfigs && dbPhaseConfigs.length > 0
            ? (dbPhaseConfigs as unknown as PhaseDefinition[])
            : DEFAULT_PHASES;

    // Phase overrides — need a representative communityId for the hook
    // We pass null when no builder selected; the hook handles "skip" internally
    const { overrides, setOverride } = usePhaseOverrides(
        filters.builderId,
        null // community-level override queries happen inside CommunityGroup
    );

    // ── Derived data ─────────────────────────────────────────────────
    // Convex returns Doc types with Id<T> | undefined; cast to string | null for components
    const entries = (blueBookResult?.entries ?? []) as unknown as BlueBookEntry[];

    // Client-side date range filter (server handles builder/status/search)
    const filteredEntries = entries.filter((e) => {
        if (filters.startDateFrom && e.startDate && e.startDate < filters.startDateFrom) return false;
        if (filters.startDateTo && e.startDate && e.startDate > filters.startDateTo) return false;
        return true;
    });

    const communityGroups = useCommunityGroups(
        filteredEntries,
        phaseConfigs,
        overrides
    );

    // ── Handlers ─────────────────────────────────────────────────────
    const handleEditEntry = useCallback(
        (entryId: string) => {
            const entry = entries.find((e) => e.id === entryId || e._id === entryId);
            if (entry) setEditingEntry(entry);
        },
        [entries]
    );

    const handlePhaseOverride = useCallback(
        async (lot: string, phaseCode: string, complete: boolean) => {
            try {
                await setOverride(lot, phaseCode, complete);
            } catch {
                toast.error('Failed to update phase');
            }
        },
        [setOverride]
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-6">
                    <PageHeader
                        title="Blue Book"
                        description="Track lot phases, payments, and service completion"
                    />
                    <div className="flex items-center gap-2">
                        {filters.builderId && (
                            <button
                                onClick={() => setShowPhaseConfig(true)}
                                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                title="Configure phases"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>
                        )}
                        <button
                            onClick={() => setShowCreate(true)}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            + New Entry
                        </button>
                    </div>
                </div>

                <BuilderTabBar
                    builders={builders}
                    activeBuilder={filters.builderId}
                    onBuilderChange={setBuilderId}
                />

                <BlueBookToolbar
                    search={rawSearch}
                    onSearchChange={setSearch}
                    sort={filters.sort}
                    onSortChange={setSort}
                    startDateFrom={filters.startDateFrom}
                    startDateTo={filters.startDateTo}
                    onDateRangeChange={setDateRange}
                    statusFilter={filters.status}
                    onStatusChange={setStatus}
                    onReset={resetFilters}
                />

                <QueryWrapper data={blueBookResult} loadingMessage="Loading Blue Book..." emptyMessage="No entries found.">
                    {() => (
                        <>
                            {communityGroups.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    {filters.builderId
                                        ? 'No entries found for this builder. Try adjusting filters.'
                                        : 'Select a builder to view phases, or use filters to search all entries.'}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {communityGroups.map((group) => (
                                        <CommunityGroup
                                            key={group.communityName}
                                            group={group}
                                            onEditEntry={handleEditEntry}
                                            onPhaseOverride={handlePhaseOverride}
                                        />
                                    ))}
                                </div>
                            )}

                            <BlueBookPagination
                                page={blueBookResult?.page ?? 1}
                                totalPages={blueBookResult?.totalPages ?? 1}
                                total={blueBookResult?.total ?? 0}
                                onPageChange={setPage}
                            />
                        </>
                    )}
                </QueryWrapper>
            </div>

            {/* Modals */}
            <EditEntryModal
                entry={editingEntry}
                isOpen={!!editingEntry}
                onClose={() => setEditingEntry(null)}
            />

            <CreateEntryModal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                builders={builders}
                defaultBuilderId={filters.builderId}
            />

            {filters.builderId && (
                <PhaseConfigEditor
                    builderId={filters.builderId}
                    isOpen={showPhaseConfig}
                    onClose={() => setShowPhaseConfig(false)}
                />
            )}
        </div>
    );
}
