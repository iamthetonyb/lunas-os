'use client';

import { useState } from 'react';
import type { CommunityGroup as CommunityGroupType } from '@/types/blue-book';
import { LotCard } from './LotCard';

type Props = {
    group: CommunityGroupType;
    onEditEntry: (entryId: string) => void;
    onPhaseOverride: (communityId: string, lot: string, phaseCode: string, complete: boolean) => void;
    onServiceToggle: (communityId: string, lot: string, phaseCode: string, serviceName: string, complete: boolean) => void;
};

export function CommunityGroup({ group, onEditEntry, onPhaseOverride, onServiceToggle }: Props) {
    const [isExpanded, setIsExpanded] = useState(true);
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
                        {group.lots.length} lots
                    </span>
                </div>
                <div className="flex items-center gap-3">
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
