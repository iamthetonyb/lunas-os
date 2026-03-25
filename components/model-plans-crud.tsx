'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from './ConfirmationDialog';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  builderId: z.string().min(1, 'Builder is required'),
  sqft: z.string().min(1, 'Square footage is required'),
  defaults: z.any().optional(),
});

type FormData = z.infer<typeof schema>;

interface ModelPlan {
  _id: Id<"modelPlans">;
  name: string;
  code: string;
  builderId: string;
  communityId?: string;
  sqft: string;
  defaults?: unknown;
}

interface Builder {
  _id: Id<"builders">;
  name: string;
}

export function ModelPlansCrud() {
  const { t } = useTranslation();
  const modelPlans = useQuery(api.queries.getModelPlans, {}) as ModelPlan[] | undefined;
  const builders = useQuery(api.queries.getBuilders, {}) as Builder[] | undefined;
  const createModelPlan = useMutation(api.mutations.createModelPlan);
  const updateModelPlan = useMutation(api.mutations.updateModelPlan);
  const deleteModelPlan = useMutation(api.mutations.deleteModelPlan);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedModelPlan, setSelectedModelPlan] = useState<ModelPlan | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (selectedModelPlan) {
        await updateModelPlan({
          id: selectedModelPlan._id,
          name: data.name,
          code: data.code,
          sqft: data.sqft,
          builderId: data.builderId as Id<"builders">,
        });
      } else {
        await createModelPlan({
          name: data.name,
          code: data.code,
          sqft: data.sqft,
          builderId: data.builderId as Id<"builders">,
        });
      }

      setIsOpen(false);
      reset();
      setSelectedModelPlan(null);
    } catch (error) {
      console.error('Failed to save model plan', error);
      toast.error('Failed to save model plan.');
    }
  });

  const openModal = (modelPlan: ModelPlan | null = null) => {
    setSelectedModelPlan(modelPlan);
    reset(modelPlan ? { name: modelPlan.name, code: modelPlan.code, builderId: modelPlan.builderId, sqft: modelPlan.sqft } : {});
    setIsOpen(true);
  };

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      await deleteModelPlan({ id: id as Id<"modelPlans"> });
      toast.success('Model plan deleted.');
    } catch (error) {
      console.error('Failed to delete model plan', error);
      toast.error('Failed to delete model plan.');
    } finally {
      setIsDeleting(null);
      setDeleteConfirm(null);
    }
  };

  const getBuilderName = (builderId: string) => {
    const builder = builders?.find((b) => b._id === builderId);
    return builder?.name || 'Unknown Builder';
  };

  return (
    <div>
      {/* Header with Add Button */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {modelPlans?.length || 0} model plan{modelPlans?.length !== 1 ? 's' : ''} configured
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Model Plan
        </button>
      </div>

      {/* Model Plans Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {!modelPlans || modelPlans.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🏠</div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">No model plans configured yet</p>
            <button
              onClick={() => openModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Model Plan
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Model Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('common.builder')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Square Footage
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-700">
                {modelPlans?.map((plan) => (
                  <Fragment key={plan._id}>
                  <tr
                    className={`cursor-pointer transition-colors ${expandedPlanId === plan._id ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                    onClick={() => setExpandedPlanId(expandedPlanId === plan._id ? null : plan._id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <svg className={`w-3 h-3 text-gray-400 transition-transform ${expandedPlanId === plan._id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {plan.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                        {plan.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {getBuilderName(plan.builderId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {plan.sqft} sqft
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openModal(plan)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(plan._id)}
                          disabled={isDeleting === plan._id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting === plan._id ? (
                            <>
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              {t('common.loading')}
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              {t('common.delete')}
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedPlanId === plan._id && (
                    <tr>
                      <td colSpan={5} className="px-6 py-0">
                        <PlanLots modelPlanId={plan._id} communityId={plan.communityId} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 dark:bg-black/50" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white dark:bg-slate-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-200 dark:border-gray-700">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-semibold leading-6 text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"
                  >
                    <span className="text-2xl">🏠</span>
                    {selectedModelPlan ? 'Edit Model Plan' : 'Add New Model Plan'}
                  </Dialog.Title>

                  <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Model Name
                      </label>
                      <input
                        id="name"
                        {...register('name')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                        placeholder="e.g., The Madison"
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Model Code
                      </label>
                      <input
                        id="code"
                        {...register('code')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                        placeholder="e.g., MAD"
                      />
                      {errors.code && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.code.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="builderId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('common.builder')}
                      </label>
                      <select
                        id="builderId"
                        {...register('builderId')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">-- Select Builder --</option>
                        {builders?.map((builder) => (
                          <option key={builder._id} value={builder._id}>
                            {builder.name}
                          </option>
                        ))}
                      </select>
                      {errors.builderId && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.builderId.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="sqft" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Square Footage
                      </label>
                      <input
                        id="sqft"
                        type="number"
                        {...register('sqft')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                        placeholder="e.g., 2400"
                      />
                      {errors.sqft && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.sqft.message}</p>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          reset();
                          setSelectedModelPlan(null);
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {t('common.loading')}
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {t('common.save')}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <ConfirmationDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Delete Model Plan"
        message="Are you sure you want to delete this model plan? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

// ── Inline Lots Panel (shown when a plan row is expanded) ─────────────

function PlanLots({ modelPlanId, communityId }: { modelPlanId: Id<"modelPlans">; communityId?: string }) {
  const { t } = useTranslation();
  const lots = useQuery(api.communityLots.byModelPlan, { modelPlanId }) ?? [];
  const createLot = useMutation(api.communityLots.create);
  const updateLot = useMutation(api.communityLots.update);
  const removeLot = useMutation(api.communityLots.remove);

  const [adding, setAdding] = useState(false);
  const [newLotNumber, setNewLotNumber] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newJobNumber, setNewJobNumber] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLotNumber, setEditLotNumber] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editJobNumber, setEditJobNumber] = useState('');

  const handleAdd = async () => {
    if (!newLotNumber.trim()) return;
    try {
      await createLot({
        communityId: (communityId ?? '') as Id<"communities">,
        modelPlanId,
        lotNumber: newLotNumber.trim(),
        address: newAddress.trim() || undefined,
        jobNumber: newJobNumber.trim() || undefined,
      });
      toast.success(t('lots.added', { lot: newLotNumber }));
      setNewLotNumber(''); setNewAddress(''); setNewJobNumber('');
      setAdding(false);
    } catch { toast.error(t('lots.addError')); }
  };

  const handleUpdate = async (id: string) => {
    if (!editLotNumber.trim()) return;
    try {
      await updateLot({
        id: id as Id<"communityLots">,
        lotNumber: editLotNumber.trim(),
        address: editAddress.trim() || undefined,
        jobNumber: editJobNumber.trim() || undefined,
      });
      toast.success(t('lots.updated'));
      setEditingId(null);
    } catch { toast.error(t('lots.updateError')); }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeLot({ id: id as Id<"communityLots"> });
      toast.success(t('lots.removed'));
    } catch { toast.error(t('lots.removeError')); }
  };

  const startEdit = (lot: any) => {
    setEditingId(lot._id);
    setEditLotNumber(lot.lotNumber ?? '');
    setEditAddress(lot.address ?? '');
    setEditJobNumber(lot.jobNumber ?? '');
  };

  return (
    <div className="py-3 mb-2 border-t border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {t('lots.title')} ({lots.length})
        </span>
        {!adding && (
          <button onClick={() => setAdding(true)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            + {t('lots.add')}
          </button>
        )}
      </div>

      {adding && (
        <div className="flex gap-2 mb-2 items-center">
          <input value={newLotNumber} onChange={(e) => setNewLotNumber(e.target.value)} placeholder={t('lots.lotNumber')} className="w-20 px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-gray-600 dark:text-white" autoFocus />
          <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder={t('lots.address')} className="flex-1 px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-gray-600 dark:text-white" />
          <input value={newJobNumber} onChange={(e) => setNewJobNumber(e.target.value)} placeholder={t('lots.jobNumber')} className="w-24 px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-gray-600 dark:text-white" />
          <button onClick={handleAdd} disabled={!newLotNumber.trim()} className="text-xs text-green-600 hover:underline disabled:opacity-50">{t('common.save')}</button>
          <button onClick={() => setAdding(false)} className="text-xs text-gray-500 hover:underline">{t('common.cancel')}</button>
        </div>
      )}

      {lots.length === 0 && !adding ? (
        <p className="text-xs text-gray-400 italic">{t('lots.none')}</p>
      ) : (
        <div className="space-y-1">
          {lots.map((lot) => (
            <div key={lot._id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-slate-700/30 text-sm">
              {editingId === lot._id ? (
                <div className="flex gap-2 flex-1 items-center">
                  <input value={editLotNumber} onChange={(e) => setEditLotNumber(e.target.value)} className="w-20 px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-gray-600 dark:text-white" autoFocus />
                  <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder={t('lots.address')} className="flex-1 px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-gray-600 dark:text-white" />
                  <input value={editJobNumber} onChange={(e) => setEditJobNumber(e.target.value)} placeholder={t('lots.jobNumber')} className="w-24 px-2 py-1 border rounded text-sm dark:bg-slate-800 dark:border-gray-600 dark:text-white" />
                  <button onClick={() => handleUpdate(lot._id)} className="text-xs text-green-600">{t('common.save')}</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-gray-500">{t('common.cancel')}</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-medium text-gray-800 dark:text-gray-200">Lot {lot.lotNumber || '—'}</span>
                    {lot.address && <span className="text-xs text-gray-400">{lot.address}</span>}
                    {lot.jobNumber && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 rounded">{lot.jobNumber}</span>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(lot)} className="px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded">{t('common.edit')}</button>
                    <button onClick={() => handleRemove(lot._id)} className="px-2 py-0.5 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">{t('common.delete')}</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
