'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { BlueBookEntry } from '@/types/blue-book';
import type { Id } from '@/convex/_generated/dataModel';

type Props = {
    entry: BlueBookEntry | null;
    isOpen: boolean;
    onClose: () => void;
    onDelete?: (id: string) => void;
};

export function EditEntryModal({ entry, isOpen, onClose, onDelete }: Props) {
    const { t } = useTranslation();
    const updateEntry = useMutation(api.blueBook.update);

    // Load model plans for the entry's builder so user can change it
    const modelPlans = useQuery(
        api.queries.getModelPlans,
        entry?.builderId ? {} : 'skip'
    );
    const filteredPlans = (modelPlans ?? []).filter(
        (p: any) => !entry?.builderId || p.builderId === entry.builderId
    );

    const [form, setForm] = useState({
        status: '',
        amount: '',
        checkNumber: '',
        checkDate: '',
        checkTotal: '',
        isAch: false,
        assignedForemanName: '',
        crewName: '',
        lot: '',
        startDate: '',
        invoiceNumber: '',
        modelPlanId: '',
    });

    useEffect(() => {
        if (entry) {
            setForm({
                status: entry.status ?? '',
                amount: entry.amount ?? '',
                checkNumber: entry.checkNumber ?? '',
                checkDate: entry.checkDate ?? '',
                checkTotal: entry.checkTotal ?? '',
                isAch: entry.isAch ?? false,
                assignedForemanName: entry.assignedForemanName ?? '',
                crewName: entry.crewName ?? '',
                lot: entry.lot ?? '',
                startDate: entry.startDate ?? '',
                invoiceNumber: entry.invoiceNumber ?? '',
                modelPlanId: entry.modelPlanId ?? '',
            });
        }
    }, [entry]);

    const handleSave = async () => {
        if (!entry) return;
        try {
            await updateEntry({
                id: entry.id as Id<'blueBookEntries'>,
                status: form.status || undefined,
                amount: form.amount || undefined,
                checkNumber: form.checkNumber || undefined,
                checkDate: form.checkDate || undefined,
                checkTotal: form.checkTotal || undefined,
                isAch: form.isAch,
                assignedForemanName: form.assignedForemanName || undefined,
                crewName: form.crewName || undefined,
                lot: form.lot || undefined,
                startDate: form.startDate || undefined,
                invoiceNumber: form.invoiceNumber || undefined,
                modelPlanId: form.modelPlanId
                    ? form.modelPlanId as Id<'modelPlans'>
                    : null,
            });
            toast.success('Entry updated');
            onClose();
        } catch (err) {
            toast.error('Failed to update entry');
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/30" />
                </Transition.Child>
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="scale-95 opacity-0" enterTo="scale-100 opacity-100" leave="ease-in duration-150" leaveFrom="scale-100 opacity-100" leaveTo="scale-95 opacity-0">
                            <Dialog.Panel className="w-full max-w-lg rounded-lg bg-white dark:bg-slate-800 p-6 shadow-2xl">
                                <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Edit Blue Book Entry
                                </Dialog.Title>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Status">
                                        <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} className="input-field">
                                            <option value="">--</option>
                                            <option value="PENDING">Pending</option>
                                            <option value="SCHEDULED">Scheduled</option>
                                            <option value="DISPATCHED">Dispatched</option>
                                            <option value="COMPLETE">Complete</option>
                                        </select>
                                    </Field>
                                    <Field label="Amount">
                                        <input type="text" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} className="input-field" />
                                    </Field>
                                    <Field label="Foreman">
                                        <input type="text" value={form.assignedForemanName} onChange={(e) => setForm(f => ({ ...f, assignedForemanName: e.target.value }))} className="input-field" />
                                    </Field>
                                    <Field label="Crew">
                                        <input type="text" value={form.crewName} onChange={(e) => setForm(f => ({ ...f, crewName: e.target.value }))} className="input-field" />
                                    </Field>
                                    <Field label="Lot">
                                        <input type="text" value={form.lot} onChange={(e) => setForm(f => ({ ...f, lot: e.target.value }))} className="input-field" />
                                    </Field>
                                    <Field label="Start Date">
                                        <input type="date" value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} className="input-field" />
                                    </Field>
                                    <Field label="Check #">
                                        <input type="text" value={form.checkNumber} onChange={(e) => setForm(f => ({ ...f, checkNumber: e.target.value }))} className="input-field" />
                                    </Field>
                                    <Field label="Check Date">
                                        <input type="date" value={form.checkDate} onChange={(e) => setForm(f => ({ ...f, checkDate: e.target.value }))} className="input-field" />
                                    </Field>
                                    <Field label="Check Total">
                                        <input type="text" value={form.checkTotal} onChange={(e) => setForm(f => ({ ...f, checkTotal: e.target.value }))} className="input-field" />
                                    </Field>
                                    <Field label="Invoice #">
                                        <input type="text" value={form.invoiceNumber} onChange={(e) => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} className="input-field" />
                                    </Field>
                                    <Field label={t('blueBook.modelPlan', 'Model Plan')}>
                                        <select
                                            value={form.modelPlanId}
                                            onChange={(e) => setForm(f => ({ ...f, modelPlanId: e.target.value }))}
                                            className="input-field"
                                        >
                                            <option value="">{t('blueBook.selectPlan', '-- None --')}</option>
                                            {filteredPlans.map((plan: any) => (
                                                <option key={plan._id} value={plan._id}>
                                                    {plan.name}{plan.code ? ` (${plan.code})` : ''}{plan.sqft ? ` - ${plan.sqft} sqft` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <div className="col-span-2 flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={form.isAch}
                                            onChange={(e) => setForm(f => ({ ...f, isAch: e.target.checked }))}
                                            className="rounded border-gray-300 dark:border-gray-600"
                                        />
                                        <label className="text-sm text-gray-700 dark:text-gray-300">ACH Payment</label>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-6">
                                    {onDelete && entry ? (
                                        <button
                                            onClick={() => { onDelete(entry.id); onClose(); }}
                                            className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
                                        >
                                            Delete Entry
                                        </button>
                                    ) : <span />}
                                    <div className="flex gap-2">
                                        <button onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                                            Cancel
                                        </button>
                                        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                            Save
                                        </button>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
            {children}
        </div>
    );
}
