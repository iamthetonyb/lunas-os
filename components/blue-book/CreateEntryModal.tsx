'use client';

import { useState, useCallback, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';
import type { Builder } from '@/types/blue-book';
import { SearchableSelect } from '../searchable-select';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    builders: Builder[];
    defaultBuilderId?: string | null;
};

export function CreateEntryModal({ isOpen, onClose, builders, defaultBuilderId }: Props) {
    const createEntry = useMutation(api.blueBook.create);
    const createCommunity = useMutation(api.mutations.createCommunity);
    const services = useQuery(api.queries.getServices, {}) ?? [];

    const [form, setForm] = useState({
        builderId: defaultBuilderId ?? '',
        communityId: '',
        serviceId: '',
        lot: '',
        startDate: '',
        status: 'PENDING',
        amount: '',
        accountCategoryName: '',
        checkNumber: '',
        checkDate: '',
        invoiceNumber: '',
    });

    const communities = useQuery(
        api.queries.getCommunitiesByBuilder,
        form.builderId ? { builderId: form.builderId as Id<'builders'> } : 'skip'
    ) ?? [];

    const communityOptions = communities.map((c: any) => ({
        value: c._id,
        label: c.name,
    }));

    const handleCreateCommunity = useCallback(async (name: string) => {
        try {
            const result = await createCommunity({
                name,
                builderId: form.builderId ? form.builderId as Id<'builders'> : undefined,
            });
            toast.success(`Community "${name}" created`);
            return result.id as string;
        } catch (err: any) {
            toast.error(err?.message ?? 'Failed to create community');
        }
    }, [createCommunity, form.builderId]);

    const handleSave = async () => {
        if (!form.builderId) {
            toast.error('Builder is required');
            return;
        }
        try {
            await createEntry({
                builderId: form.builderId as Id<'builders'>,
                communityId: form.communityId ? (form.communityId as Id<'communities'>) : undefined,
                serviceId: form.serviceId ? (form.serviceId as Id<'services'>) : undefined,
                lot: form.lot || undefined,
                startDate: form.startDate || undefined,
                status: form.status || undefined,
                amount: form.amount ? parseFloat(form.amount) : undefined,
                accountCategoryName: form.accountCategoryName || undefined,
                checkNumber: form.checkNumber || undefined,
                checkDate: form.checkDate || undefined,
                invoiceNumber: form.invoiceNumber || undefined,
            });
            toast.success('Entry created');
            onClose();
            setForm({
                builderId: defaultBuilderId ?? '',
                communityId: '',
                serviceId: '',
                lot: '',
                startDate: '',
                status: 'PENDING',
                amount: '',
                accountCategoryName: '',
                checkNumber: '',
                checkDate: '',
                invoiceNumber: '',
            });
        } catch {
            toast.error('Failed to create entry');
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
                                    New Blue Book Entry
                                </Dialog.Title>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Builder">
                                        <select value={form.builderId} onChange={(e) => setForm(f => ({ ...f, builderId: e.target.value, communityId: '' }))} className="input-field">
                                            <option value="">Select builder...</option>
                                            {builders.map(b => (
                                                <option key={b._id} value={b._id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Community">
                                        <SearchableSelect
                                            value={form.communityId}
                                            onChange={(val) => setForm(f => ({ ...f, communityId: val }))}
                                            options={communityOptions}
                                            placeholder={form.builderId ? "Search or type new..." : "Select a builder first"}
                                            disabled={!form.builderId}
                                            emptyStateLabel="No communities found"
                                            allowCreate={!!form.builderId}
                                            onCreateOption={handleCreateCommunity}
                                            createLabel="Create community"
                                        />
                                    </Field>
                                    <Field label="Service">
                                        <select value={form.serviceId} onChange={(e) => setForm(f => ({ ...f, serviceId: e.target.value }))} className="input-field">
                                            <option value="">Select service...</option>
                                            {services.map((s: { _id: string; name: string }) => (
                                                <option key={s._id} value={s._id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Status">
                                        <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} className="input-field">
                                            <option value="PENDING">Pending</option>
                                            <option value="SCHEDULED">Scheduled</option>
                                            <option value="DISPATCHED">Dispatched</option>
                                            <option value="COMPLETE">Complete</option>
                                        </select>
                                    </Field>
                                    <Field label="Lot">
                                        <input type="text" value={form.lot} onChange={(e) => setForm(f => ({ ...f, lot: e.target.value }))} className="input-field" />
                                    </Field>
                                    <Field label="Completed Date">
                                        <input type="date" value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} className="input-field" />
                                    </Field>
                                    <Field label="Amount">
                                        <input type="text" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} className="input-field" placeholder="0.00" />
                                    </Field>
                                    <Field label="Category">
                                        <input type="text" value={form.accountCategoryName} onChange={(e) => setForm(f => ({ ...f, accountCategoryName: e.target.value }))} className="input-field" />
                                    </Field>
                                    <Field label="Check #">
                                        <input type="text" value={form.checkNumber} onChange={(e) => setForm(f => ({ ...f, checkNumber: e.target.value }))} className="input-field" />
                                    </Field>
                                    <Field label="Check Date">
                                        <input type="date" value={form.checkDate} onChange={(e) => setForm(f => ({ ...f, checkDate: e.target.value }))} className="input-field" />
                                    </Field>
                                    <Field label="Invoice #">
                                        <input type="text" value={form.invoiceNumber} onChange={(e) => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} className="input-field" />
                                    </Field>
                                </div>

                                <div className="flex justify-end gap-2 mt-6">
                                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                                        Cancel
                                    </button>
                                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                        Create
                                    </button>
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
