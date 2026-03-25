'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';
import { useTranslation } from 'react-i18next';

type Props = {
    communityId: string;
    communityName: string;
    builderId?: string;
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

export function CommunityPhaseEditor({ communityId, communityName, builderId, isOpen, onClose }: Props) {
    const { t } = useTranslation();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<PhaseForm>(emptyForm);
    const [showForm, setShowForm] = useState(false);

    const phases = useQuery(
        api.blueBookPhases.getByCommunity,
        communityId ? { communityId: communityId as Id<'communities'> } : 'skip'
    );
    const createPhase = useMutation(api.blueBookPhases.createCommunityPhase);
    const updatePhase = useMutation(api.blueBookPhases.updateCommunityPhase);
    const removePhase = useMutation(api.blueBookPhases.removeCommunityPhase);
    const copyFromBuilder = useMutation(api.blueBookPhases.copyBuilderPhasesToCommunity);

    const handleSave = async () => {
        if (!form.code.trim() || !form.title.trim() || !form.shorthand.trim()) {
            toast.error(t('blueBook.phaseFieldsRequired', 'Code, title, and shorthand are required'));
            return;
        }
        const serviceNames = form.serviceNames.split(',').map((s) => s.trim()).filter(Boolean);
        if (serviceNames.length === 0) {
            toast.error(t('blueBook.phaseServicesRequired', 'At least one service name is required'));
            return;
        }

        try {
            if (editingId) {
                await updatePhase({
                    id: editingId as Id<'communityPhaseConfigs'>,
                    title: form.title,
                    shorthand: form.shorthand,
                    serviceNames,
                    sortOrder: form.sortOrder,
                });
                toast.success(t('blueBook.phaseUpdated', 'Phase updated'));
            } else {
                await createPhase({
                    communityId: communityId as Id<'communities'>,
                    builderId: builderId ? builderId as Id<'builders'> : undefined,
                    code: form.code.trim(),
                    title: form.title.trim(),
                    shorthand: form.shorthand.trim(),
                    serviceNames,
                    sortOrder: form.sortOrder,
                });
                toast.success(t('blueBook.phaseCreated', 'Phase created'));
            }
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(false);
        } catch (err: any) {
            toast.error(err?.message ?? 'Failed to save phase');
        }
    };

    const handleCopyFromBuilder = async () => {
        if (!builderId) {
            toast.error('No builder associated with this community');
            return;
        }
        try {
            const result = await copyFromBuilder({
                builderId: builderId as Id<'builders'>,
                communityId: communityId as Id<'communities'>,
            });
            toast.success(`Copied ${result.copied} phases from builder`);
        } catch (err: any) {
            toast.error(err?.message ?? 'Failed to copy phases');
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child as={Fragment}
                    enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
                    leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/30" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child as={Fragment}
                            enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
                            leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6">
                                <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                    {t('blueBook.editCommunityPhases', 'Edit Phases')}
                                </Dialog.Title>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{communityName}</p>

                                {/* Existing phases */}
                                <div className="space-y-2 mb-4">
                                    {phases && phases.length > 0 ? (
                                        phases.map((phase: any) => (
                                            <div key={phase._id} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-700 rounded-lg">
                                                <div>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{phase.shorthand}</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{phase.title}</span>
                                                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                                        {phase.serviceNames.join(', ')}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingId(phase._id);
                                                            setForm({
                                                                code: phase.code,
                                                                title: phase.title,
                                                                shorthand: phase.shorthand,
                                                                serviceNames: phase.serviceNames.join(', '),
                                                                sortOrder: phase.sortOrder,
                                                            });
                                                            setShowForm(true);
                                                        }}
                                                        className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            await removePhase({ id: phase._id as Id<'communityPhaseConfigs'> });
                                                            toast.success('Phase removed');
                                                        }}
                                                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                                            {t('blueBook.noCustomPhases', 'No custom phases — using builder defaults')}
                                        </p>
                                    )}
                                </div>

                                {/* Add/Edit form */}
                                {showForm ? (
                                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 space-y-3 mb-4">
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    {t('blueBook.phaseCode', 'Code')}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={form.code}
                                                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                                                    disabled={!!editingId}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white disabled:opacity-50"
                                                    placeholder="22702"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    {t('blueBook.phaseShorthand', 'Shorthand')}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={form.shorthand}
                                                    onChange={(e) => setForm({ ...form, shorthand: e.target.value })}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                                    placeholder="T3"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    {t('blueBook.phaseSortOrder', 'Order')}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={form.sortOrder}
                                                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                {t('blueBook.phaseTitle', 'Title')}
                                            </label>
                                            <input
                                                type="text"
                                                value={form.title}
                                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                                placeholder="22702 – T3"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                {t('blueBook.phaseServices', 'Services (comma-separated)')}
                                            </label>
                                            <input
                                                type="text"
                                                value={form.serviceNames}
                                                onChange={(e) => setForm({ ...form, serviceNames: e.target.value })}
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                                placeholder="Frame Sweep, Paint Sweep"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
                                                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md"
                                            >
                                                {t('common.cancel', 'Cancel')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSave}
                                                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                            >
                                                {editingId ? t('common.save', 'Save') : t('blueBook.addPhase', 'Add Phase')}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2 mb-4">
                                        <button
                                            type="button"
                                            onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
                                            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                        >
                                            + {t('blueBook.addPhase', 'Add Phase')}
                                        </button>
                                        {builderId && (!phases || phases.length === 0) && (
                                            <button
                                                type="button"
                                                onClick={handleCopyFromBuilder}
                                                className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700"
                                            >
                                                {t('blueBook.copyFromBuilder', 'Copy from Builder')}
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
                                    >
                                        {t('common.close', 'Close')}
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
