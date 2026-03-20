'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LotPhase } from '@/types/blue-book';

type Props = {
    phases: LotPhase[];
    lot: string;
    onPhaseOverride: (lot: string, phaseCode: string, complete: boolean) => void;
    onServiceToggle: (lot: string, phaseCode: string, serviceName: string, complete: boolean) => void;
};

export function PhaseBoard({ phases, lot, onPhaseOverride, onServiceToggle }: Props) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState<string | null>(null);

    if (!phases.length) return null;

    // Service-level completion: logged services / total services across all phases
    const totalServices = phases.reduce((sum, p) => sum + p.services.length, 0);
    const loggedServices = phases.reduce(
        (sum, p) => sum + p.services.filter((s) => s.isLogged).length,
        0
    );
    const pct = totalServices > 0 ? Math.round((loggedServices / totalServices) * 100) : 0;

    const expandedPhase = expanded ? phases.find((p) => p.code === expanded) : null;

    return (
        <div className="space-y-1.5">
            {/* Phase pills row */}
            <div className="flex items-center gap-1.5 flex-wrap">
                {phases.map((phase) => {
                    const svcDone = phase.services.filter((s) => s.isLogged).length;
                    const svcTotal = phase.services.length;
                    return (
                        <button
                            key={phase.code}
                            type="button"
                            onClick={() => setExpanded(expanded === phase.code ? null : phase.code)}
                            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 min-w-[48px] min-h-[32px] cursor-pointer select-none ${
                                phase.isComplete
                                    ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700 shadow-sm'
                                    : svcDone > 0
                                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700'
                            } ${expanded === phase.code ? 'ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
                            title={`${phase.title}: ${svcDone}/${svcTotal} ${t('blueBook.services')}`}
                        >
                            {phase.shorthand}
                            {svcTotal > 0 && (
                                <span className="ml-1 text-[9px] opacity-70">
                                    {svcDone}/{svcTotal}
                                </span>
                            )}
                        </button>
                    );
                })}
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
            {expandedPhase && (
                <div className="ml-1 pl-3 border-l-2 border-blue-300 dark:border-blue-600 space-y-1.5 py-1.5 bg-gray-50/50 dark:bg-slate-800/50 rounded-r-md pr-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                            {expandedPhase.title}
                        </span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onPhaseOverride(lot, expandedPhase.code, !expandedPhase.isComplete);
                            }}
                            className={`text-[11px] px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                                expandedPhase.isComplete
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400'
                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-700 dark:hover:text-green-400'
                            }`}
                        >
                            {expandedPhase.isComplete ? t('blueBook.markIncomplete') : t('blueBook.markComplete')}
                        </button>
                    </div>
                    {expandedPhase.services.map((svc) => (
                        <button
                            key={svc.name}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onServiceToggle(lot, expandedPhase.code, svc.name, !svc.isLogged);
                            }}
                            className="flex items-center gap-2 text-xs py-1 px-1 -mx-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer w-full text-left"
                        >
                            <span
                                className={`w-4 h-4 rounded flex items-center justify-center text-[11px] flex-shrink-0 transition-colors ${
                                    svc.isLogged
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400 border border-gray-300 dark:border-gray-600 hover:border-green-400'
                                }`}
                            >
                                {svc.isLogged ? '\u2713' : ''}
                            </span>
                            <span
                                className={
                                    svc.isLogged
                                        ? 'text-gray-700 dark:text-gray-300 font-medium'
                                        : 'text-gray-400 dark:text-gray-500'
                                }
                            >
                                {svc.name}
                            </span>
                            {svc.entries.length > 0 && (
                                <span className="text-[10px] text-gray-400 ml-auto">
                                    {svc.entries.length} {svc.entries.length === 1 ? t('blueBook.entry') : t('blueBook.entries')}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
