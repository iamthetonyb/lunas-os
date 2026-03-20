'use client';

import type { LotPhase } from '@/types/blue-book';

type Props = {
    phases: LotPhase[];
    lot: string;
    onPhaseOverride: (lot: string, phaseCode: string, complete: boolean) => void;
};

export function PhaseBoard({ phases, lot, onPhaseOverride }: Props) {
    if (!phases.length) return null;

    return (
        <div className="flex flex-wrap gap-1.5">
            {phases.map((phase) => (
                <button
                    key={phase.code}
                    type="button"
                    onClick={() => onPhaseOverride(lot, phase.code, !phase.isComplete)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors duration-200 min-w-[44px] min-h-[28px] ${
                        phase.isComplete
                            ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700'
                            : phase.matchingEntries.length > 0
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700'
                            : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700'
                    }`}
                    title={`${phase.title}: ${phase.isComplete ? 'Complete' : phase.matchingEntries.length > 0 ? 'In progress' : 'Not started'}`}
                >
                    {phase.shorthand}
                </button>
            ))}
        </div>
    );
}
