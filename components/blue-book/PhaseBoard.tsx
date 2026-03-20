'use client';

import { useState } from 'react';
import type { LotPhase } from '@/types/blue-book';

type Props = {
    phases: LotPhase[];
    lot: string;
    onPhaseOverride: (lot: string, phaseCode: string, complete: boolean) => void;
};

export function PhaseBoard({ phases, lot, onPhaseOverride }: Props) {
    const [expanded, setExpanded] = useState<string | null>(null);

    if (!phases.length) return null;

    // Overall completion: count completed phases / total phases
    const completed = phases.filter((p) => p.isComplete).length;
    const total = phases.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div className="space-y-1.5">
            {/* Phase pills row */}
            <div className="flex items-center gap-1.5">
                {phases.map((phase) => (
                    <button
                        key={phase.code}
                        type="button"
                        onClick={() => setExpanded(expanded === phase.code ? null : phase.code)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 min-w-[48px] min-h-[32px] ${
                            phase.isComplete
                                ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700 shadow-sm'
                                : phase.matchingEntries.length > 0
                                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700'
                        } ${expanded === phase.code ? 'ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
                        title={`${phase.title}: ${phase.services.filter(s => s.isLogged).length}/${phase.services.length} services`}
                    >
                        {phase.shorthand}
                    </button>
                ))}
                {/* Inline completion bar */}
                <div className="flex items-center gap-1.5 ml-auto">
                    <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 w-7 text-right">{pct}%</span>
                </div>
            </div>

            {/* Expanded phase detail */}
            {expanded && (() => {
                const phase = phases.find((p) => p.code === expanded);
                if (!phase) return null;
                return (
                    <div className="ml-1 pl-3 border-l-2 border-blue-300 dark:border-blue-600 space-y-1 py-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                {phase.title}
                            </span>
                            <button
                                type="button"
                                onClick={() => onPhaseOverride(lot, phase.code, !phase.isComplete)}
                                className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                                    phase.isComplete
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-700 dark:hover:text-green-400'
                                }`}
                            >
                                {phase.isComplete ? 'Mark Incomplete' : 'Mark Complete'}
                            </button>
                        </div>
                        {phase.services.map((svc) => (
                            <div key={svc.name} className="flex items-center gap-2 text-xs">
                                <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                                    svc.isLogged
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                                }`}>
                                    {svc.isLogged ? '\u2713' : ''}
                                </span>
                                <span className={svc.isLogged
                                    ? 'text-gray-700 dark:text-gray-300'
                                    : 'text-gray-400 dark:text-gray-500'
                                }>
                                    {svc.name}
                                </span>
                                {svc.entries.length > 0 && (
                                    <span className="text-[10px] text-gray-400">
                                        ({svc.entries.length} {svc.entries.length === 1 ? 'entry' : 'entries'})
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                );
            })()}
        </div>
    );
}
