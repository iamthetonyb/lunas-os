'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommunityGroup as CommunityGroupType } from '@/types/blue-book';
import { LotCard } from './LotCard';

type Props = {
    group: CommunityGroupType;
    onEditEntry: (entryId: string) => void;
    onDeleteEntry: (entryId: string) => void;
    onPhaseOverride: (communityId: string, lot: string, phaseCode: string, complete: boolean) => void;
    onServiceToggle: (communityId: string, lot: string, phaseCode: string, serviceName: string, complete: boolean) => void;
    onSetCommunityBilling?: (communityId: string, billingStatus: string) => void;
};

export function CommunityGroup({ group, onEditEntry, onDeleteEntry, onPhaseOverride, onServiceToggle, onSetCommunityBilling }: Props) {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const completionPct = group.totalEntries > 0
        ? Math.round((group.completedEntries / group.totalEntries) * 100)
        : 0;

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-750 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <svg
                        className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {group.communityName}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {group.lots.length} {t('blueBook.lots')} · {group.totalEntries} entries
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {isExpanded && onSetCommunityBilling && (
                        <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {[
                                { value: 'invoiced_paid', label: t('blueBook.invoicedPaid'), color: 'bg-green-500' },
                                { value: 'admin', label: t('blueBook.adminPaid'), color: 'bg-blue-500' },
                                { value: 'no_invoice', label: t('blueBook.noBilling'), color: 'bg-gray-300 dark:bg-gray-500' },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSetCommunityBilling(group.communityId ?? '', opt.value);
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-full border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                    title={opt.label}
                                >
                                    <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                                    <span className="hidden sm:inline">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full transition-all duration-300"
                            style={{ width: `${completionPct}%` }}
                        />
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-10 text-right">
                        {completionPct}%
                    </span>
                </div>
            </button>

            {isExpanded && (
                <div className="p-4 space-y-3">
                    {group.lots.map((lot) => (
                        <LotCard
                            key={lot.key}
                            lot={lot}
                            onEditEntry={onEditEntry}
                            onDeleteEntry={onDeleteEntry}
                            onPhaseOverride={(lotName, phaseCode, complete) =>
                                onPhaseOverride(group.communityId ?? '', lotName, phaseCode, complete)
                            }
                            onServiceToggle={(lotName, phaseCode, serviceName, complete) =>
                                onServiceToggle(group.communityId ?? '', lotName, phaseCode, serviceName, complete)
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
