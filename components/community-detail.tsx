'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Id } from '@/convex/_generated/dataModel';

interface CommunityDetailProps {
    communityId: Id<'communities'>;
    communityName: string;
    builderId?: Id<'builders'> | null;
    onClose: () => void;
}

export function CommunityDetail({ communityId, communityName, builderId, onClose }: CommunityDetailProps) {
    const { t } = useTranslation();
    const plans = useQuery(api.queries.getModelPlansByCommunity, { communityId }) ?? [];
    const lots = useQuery(api.communityLots.byCommunity, { communityId }) ?? [];
    const createModelPlan = useMutation(api.mutations.createModelPlan);
    const updateModelPlan = useMutation(api.mutations.updateModelPlan);
    const deleteModelPlan = useMutation(api.mutations.deleteModelPlan);

    const [addingPlan, setAddingPlan] = useState(false);
    const [newPlanName, setNewPlanName] = useState('');
    const [newPlanCode, setNewPlanCode] = useState('');
    const [newPlanSqft, setNewPlanSqft] = useState('');
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editCode, setEditCode] = useState('');
    const [editSqft, setEditSqft] = useState('');

    const handleAddPlan = async () => {
        if (!newPlanName.trim()) return;
        try {
            await createModelPlan({
                name: newPlanName.trim(),
                code: newPlanCode.trim() || undefined,
                sqft: newPlanSqft.trim() || undefined,
                communityId,
                builderId: builderId ?? undefined,
            });
            toast.success(t('community.planAdded', { name: newPlanName }));
            setNewPlanName('');
            setNewPlanCode('');
            setNewPlanSqft('');
            setAddingPlan(false);
        } catch {
            toast.error(t('community.planAddError'));
        }
    };

    const handleUpdatePlan = async (id: string) => {
        if (!editName.trim()) return;
        try {
            await updateModelPlan({
                id: id as Id<'modelPlans'>,
                name: editName.trim(),
                code: editCode.trim() || undefined,
                sqft: editSqft.trim() || undefined,
            });
            toast.success(t('community.planUpdated'));
            setEditingPlanId(null);
        } catch {
            toast.error(t('community.planUpdateError'));
        }
    };

    const handleDeletePlan = async (id: string, name: string) => {
        try {
            await deleteModelPlan({ id: id as Id<'modelPlans'> });
            toast.success(t('community.planDeleted', { name }));
        } catch {
            toast.error(t('community.planDeleteError'));
        }
    };

    const startEdit = (plan: { _id: string; name: string; code?: string; sqft?: string }) => {
        setEditingPlanId(plan._id);
        setEditName(plan.name);
        setEditCode(plan.code ?? '');
        setEditSqft(plan.sqft ?? '');
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 rounded-t-lg">
                <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{communityName}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {plans.length} {t('community.plans')} · {lots.length} {t('community.lots')}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
                >
                    ✕
                </button>
            </div>

            {/* Plans Section */}
            <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        {t('community.modelPlans')}
                    </h4>
                    {!addingPlan && (
                        <button
                            onClick={() => setAddingPlan(true)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            + {t('community.addPlan')}
                        </button>
                    )}
                </div>

                {/* Add Plan Form */}
                {addingPlan && (
                    <div className="mb-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                            <input
                                type="text"
                                value={newPlanName}
                                onChange={(e) => setNewPlanName(e.target.value)}
                                placeholder={t('community.planName')}
                                className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-slate-800 dark:text-white"
                                autoFocus
                            />
                            <input
                                type="text"
                                value={newPlanCode}
                                onChange={(e) => setNewPlanCode(e.target.value)}
                                placeholder={t('community.planCode')}
                                className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-slate-800 dark:text-white"
                            />
                            <input
                                type="text"
                                value={newPlanSqft}
                                onChange={(e) => setNewPlanSqft(e.target.value)}
                                placeholder={t('community.sqft')}
                                className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-slate-800 dark:text-white"
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setAddingPlan(false)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleAddPlan}
                                disabled={!newPlanName.trim()}
                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                {t('common.save')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Plans List */}
                {plans.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">{t('community.noPlans')}</p>
                ) : (
                    <div className="space-y-1">
                        {plans.map((plan) => (
                            <div key={plan._id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                {editingPlanId === plan._id ? (
                                    <div className="flex gap-2 flex-1 items-center">
                                        <input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="flex-1 px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-gray-600 dark:text-white"
                                            autoFocus
                                        />
                                        <input
                                            value={editCode}
                                            onChange={(e) => setEditCode(e.target.value)}
                                            placeholder={t('community.planCode')}
                                            className="w-20 px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-gray-600 dark:text-white"
                                        />
                                        <input
                                            value={editSqft}
                                            onChange={(e) => setEditSqft(e.target.value)}
                                            placeholder={t('community.sqft')}
                                            className="w-20 px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-gray-600 dark:text-white"
                                        />
                                        <button onClick={() => handleUpdatePlan(plan._id)} className="text-green-600 text-xs">{t('common.save')}</button>
                                        <button onClick={() => setEditingPlanId(null)} className="text-gray-500 text-xs">{t('common.cancel')}</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3 flex-1">
                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{plan.name}</span>
                                            {plan.code && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 rounded border border-gray-200 dark:border-gray-600">
                                                    {plan.code}
                                                </span>
                                            )}
                                            {plan.sqft && (
                                                <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                                                    {plan.sqft} {t('community.sqftLabel')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => startEdit(plan)}
                                                className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                            >
                                                {t('common.edit')}
                                            </button>
                                            <button
                                                onClick={() => handleDeletePlan(plan._id, plan.name)}
                                                className="px-2 py-1 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                            >
                                                {t('common.delete')}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Lots Section */}
                {lots.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            {t('community.lots')} ({lots.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                            {lots.map((lot) => (
                                <span
                                    key={lot._id}
                                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600"
                                    title={lot.address || lot.model || undefined}
                                >
                                    {lot.lotNumber || lot.jobNumber || '—'}
                                    {lot.model && <span className="text-gray-400 ml-1">({lot.model})</span>}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
