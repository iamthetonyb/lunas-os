'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';

type Props = {
    builderId: string;
    isOpen: boolean;
    onClose: () => void;
};

type PhaseForm = {
    code: string;
    title: string;
    shorthand: string;
    serviceNames: string;
    sortOrder: number;
};

const emptyForm: PhaseForm = {
    code: '',
    title: '',
    shorthand: '',
    serviceNames: '',
    sortOrder: 0,
};

export function PhaseConfigEditor({ builderId, isOpen, onClose }: Props) {
    const phases = useQuery(
        api.blueBookPhases.getByBuilder,
        { builderId: builderId as Id<'builders'> }
    );
    const createPhase = useMutation(api.blueBookPhases.create);
    const updatePhase = useMutation(api.blueBookPhases.update);
    const removePhase = useMutation(api.blueBookPhases.remove);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<PhaseForm>(emptyForm);
    const [showForm, setShowForm] = useState(false);

    const startAdd = () => {
        setEditingId(null);
        setForm({ ...emptyForm, sortOrder: (phases?.length ?? 0) + 1 });
        setShowForm(true);
    };

    const startEdit = (phase: NonNullable<typeof phases>[number]) => {
        setEditingId(phase._id);
        setForm({
            code: phase.code,
            title: phase.title,
            shorthand: phase.shorthand,
            serviceNames: phase.serviceNames.join(', '),
            sortOrder: phase.sortOrder,
        });
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.code || !form.title || !form.shorthand) {
            toast.error('Code, title, and shorthand are required');
            return;
        }
        const serviceNames = form.serviceNames
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        try {
            if (editingId) {
                await updatePhase({
                    id: editingId as Id<'builderPhaseConfigs'>,
                    title: form.title,
                    shorthand: form.shorthand,
                    serviceNames,
                    sortOrder: form.sortOrder,
                    active: true,
                });
                toast.success('Phase updated');
            } else {
                await createPhase({
                    builderId: builderId as Id<'builders'>,
                    code: form.code,
                    title: form.title,
                    shorthand: form.shorthand,
                    serviceNames,
                    sortOrder: form.sortOrder,
                });
                toast.success('Phase created');
            }
            setShowForm(false);
            setForm(emptyForm);
        } catch {
            toast.error('Failed to save phase');
        }
    };

    const handleRemove = async (id: string) => {
        try {
            await removePhase({ id: id as Id<'builderPhaseConfigs'> });
            toast.success('Phase removed');
        } catch {
            toast.error('Failed to remove phase');
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
                            <Dialog.Panel className="w-full max-w-xl rounded-lg bg-white dark:bg-slate-800 p-6 shadow-2xl">
                                <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
                                    <span>Phase Configuration</span>
                                    <button
                                        onClick={startAdd}
                                        className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        + Add Phase
                                    </button>
                                </Dialog.Title>

                                {/* Phase list */}
                                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                                    {phases === undefined ? (
                                        <p className="text-sm text-gray-400">Loading...</p>
                                    ) : phases.length === 0 ? (
                                        <p className="text-sm text-gray-400">No phases configured. Add one to get started.</p>
                                    ) : (
                                        phases.map((phase: any) => (
                                            <div
                                                key={phase._id}
                                                className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-700 rounded-lg"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-mono px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                                        {phase.shorthand}
                                                    </span>
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-900 dark:text-white">{phase.title}</span>
                                                        <span className="text-xs text-gray-400 ml-2">({phase.code})</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => startEdit(phase)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                                        Edit
                                                    </button>
                                                    <button onClick={() => handleRemove(phase._id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Add/Edit form */}
                                {showForm && (
                                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4">
                                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                            {editingId ? 'Edit Phase' : 'New Phase'}
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Code</label>
                                                <input
                                                    type="text"
                                                    value={form.code}
                                                    onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                                                    disabled={!!editingId}
                                                    className="input-field"
                                                    placeholder="SWEEP"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Shorthand</label>
                                                <input
                                                    type="text"
                                                    value={form.shorthand}
                                                    onChange={(e) => setForm(f => ({ ...f, shorthand: e.target.value }))}
                                                    className="input-field"
                                                    placeholder="SWP"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs text-gray-500 mb-1">Title</label>
                                                <input
                                                    type="text"
                                                    value={form.title}
                                                    onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                                                    className="input-field"
                                                    placeholder="Sweep / Broom Clean"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs text-gray-500 mb-1">Service Names (comma-separated)</label>
                                                <input
                                                    type="text"
                                                    value={form.serviceNames}
                                                    onChange={(e) => setForm(f => ({ ...f, serviceNames: e.target.value }))}
                                                    className="input-field"
                                                    placeholder="Sweep, Broom Clean"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Sort Order</label>
                                                <input
                                                    type="number"
                                                    value={form.sortOrder}
                                                    onChange={(e) => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                                                    className="input-field"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 mt-3">
                                            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                                                Cancel
                                            </button>
                                            <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                                {editingId ? 'Update' : 'Create'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end">
                                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                                        Close
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
