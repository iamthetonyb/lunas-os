'use client';

import { useTranslation } from 'react-i18next';
import type { LotSummary } from '@/types/blue-book';
import { PhaseBoard } from './PhaseBoard';

type Props = {
    lot: LotSummary;
    onEditEntry: (entryId: string) => void;
    onDeleteEntry: (entryId: string) => void;
    onPhaseOverride: (lot: string, phaseCode: string, complete: boolean) => void;
    onServiceToggle: (lot: string, phaseCode: string, serviceName: string, complete: boolean) => void;
};

export function LotCard({ lot, onEditEntry, onDeleteEntry, onPhaseOverride, onServiceToggle }: Props) {
    const { t } = useTranslation();
    const totalAmount = lot.entries.reduce((sum, e) => {
        const amt = parseFloat(e.amount ?? '0');
        return sum + (isNaN(amt) ? 0 : amt);
    }, 0);

    return (
        <div className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {t('blueBook.lotLabel')} {lot.lot}
                    </span>
                    {lot.modelPlanCode && (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                            {lot.modelPlanCode}
                            {lot.modelPlanSqft && ` (${lot.modelPlanSqft} sqft)`}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {totalAmount > 0 && (
                        <span className="text-xs font-medium text-green-700 dark:text-green-400">
                            ${totalAmount.toFixed(2)}
                        </span>
                    )}
                    <span className="text-xs text-gray-400">
                        {lot.entries.length} {t('blueBook.entries')}
                    </span>
                </div>
            </div>

            <PhaseBoard
                phases={lot.phases}
                lot={lot.lot}
                onPhaseOverride={onPhaseOverride}
                onServiceToggle={onServiceToggle}
            />

            {/* Entry table */}
            {lot.entries.length > 0 && (
                <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full text-xs">
                        <thead>
                            <tr className="text-left text-gray-500 dark:text-gray-400">
                                <th className="pr-2 py-1">{t('blueBook.serviceHeader')}</th>
                                <th className="pr-2 py-1">{t('blueBook.startHeader')}</th>
                                <th className="pr-2 py-1">{t('blueBook.statusHeader')}</th>
                                <th className="pr-2 py-1">{t('blueBook.foremanCrewHeader')}</th>
                                <th className="pr-2 py-1">{t('blueBook.amountHeader')}</th>
                                <th className="pr-2 py-1">{t('blueBook.checkHeader')}</th>
                                <th className="py-1"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {lot.entries.map((entry) => (
                                <tr key={entry.id} className="text-gray-700 dark:text-gray-300">
                                    <td className="pr-2 py-1">{entry.serviceName ?? entry.accountCategoryName ?? '—'}</td>
                                    <td className="pr-2 py-1">{entry.startDate ?? '—'}</td>
                                    <td className="pr-2 py-1">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                            entry.status === 'COMPLETE' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                                            entry.status === 'DISPATCHED' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                                            'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                                        }`}>
                                            {entry.status}
                                        </span>
                                    </td>
                                    <td className="pr-2 py-1">
                                        {entry.assignedForemanName && entry.crewName
                                            ? `${entry.assignedForemanName} / ${entry.crewName}`
                                            : entry.assignedForemanName ?? entry.crewName ?? '—'}
                                    </td>
                                    <td className="pr-2 py-1">{entry.amount ? `$${entry.amount}` : '—'}</td>
                                    <td className="pr-2 py-1">{entry.checkNumber ?? '—'}</td>
                                    <td className="py-1">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => onEditEntry(entry.id)}
                                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                {t('blueBook.edit')}
                                            </button>
                                            <button
                                                onClick={() => onDeleteEntry(entry.id)}
                                                className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                                                title={t('common.delete')}
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
