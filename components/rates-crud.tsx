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

const schema = z.object({
  builderId: z.string().min(1, 'Builder is required'),
  serviceId: z.string().min(1, 'Service is required'),
  modelPlanId: z.string().optional(),
  basis: z.string().min(1, 'Basis is required'),
  rate: z.preprocess((val) => {
    if (typeof val === 'string') return parseFloat(val);
    return val;
  }, z.number().min(0, 'Rate must be positive')),
  unitLabel: z.string().optional(),
  effectiveOn: z.string().min(1, 'Effective date is required'),
  expiresOn: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Rate {
  _id: Id<"contractRates">;
  builderId: string;
  serviceId: string;
  modelPlanId: string | null;
  basis: string;
  rate: number;
  unitLabel?: string;
  effectiveOn: string;
  expiresOn?: string;
}

interface Builder {
  _id: Id<"builders">;
  name: string;
}

interface Service {
  _id: Id<"services">;
  name: string;
}

interface ModelPlan {
  _id: Id<"modelPlans">;
  name: string;
  builderId: string;
}

export function RatesCrud() {
  const { t } = useTranslation();
  const rates = useQuery(api.contractRates.list) as Rate[] | undefined;
  const builders = useQuery(api.queries.getBuilders) as Builder[] | undefined;
  const services = useQuery(api.queries.getServices) as Service[] | undefined;
  const modelPlans = useQuery(api.queries.getModelPlans) as ModelPlan[] | undefined;
  const createRate = useMutation(api.contractRates.create);
  const updateRate = useMutation(api.contractRates.update);
  const removeRate = useMutation(api.contractRates.remove);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedRateForPreview, setSelectedRateForPreview] = useState<Rate | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  });

  const selectedBuilderId = watch('builderId');

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (selectedRate) {
        await updateRate({
          id: selectedRate._id,
          builderId: data.builderId as Id<"builders">,
          serviceId: data.serviceId as Id<"services">,
          modelPlanId: data.modelPlanId ? data.modelPlanId as Id<"modelPlans"> : undefined,
          basis: data.basis,
          rate: String(data.rate),
          unitLabel: data.unitLabel,
          effectiveOn: data.effectiveOn,
          expiresOn: data.expiresOn,
        });
      } else {
        await createRate({
          builderId: data.builderId as Id<"builders">,
          serviceId: data.serviceId as Id<"services">,
          modelPlanId: data.modelPlanId ? data.modelPlanId as Id<"modelPlans"> : undefined,
          basis: data.basis,
          rate: String(data.rate),
          unitLabel: data.unitLabel,
          effectiveOn: data.effectiveOn,
          expiresOn: data.expiresOn,
        });
      }

      setIsOpen(false);
      reset();
      setSelectedRate(null);
    } catch (error) {
      console.error('Failed to save rate', error);
      alert('Failed to save rate.');
    }
  });

  const openModal = (rate: Rate | null = null) => {
    setSelectedRate(rate);
    if (rate) {
      // Convert null values to undefined for the form
      reset({
        ...rate,
        modelPlanId: rate.modelPlanId ?? undefined,
        unitLabel: rate.unitLabel ?? undefined,
        expiresOn: rate.expiresOn ?? undefined,
      });
    } else {
      reset({});
    }
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rate?')) return;

    setIsDeleting(id);
    try {
      await removeRate({ id: id as Id<"contractRates"> });
    } catch (error) {
      console.error('Failed to delete rate', error);
      alert('Failed to delete rate.');
    } finally {
      setIsDeleting(null);
    }
  };

  const openPreviewModal = (rate: Rate) => {
    setSelectedRateForPreview(rate);
    setIsPreviewOpen(true);
  };

  const getBuilderName = (builderId: string) => {
    const builder = builders?.find((b) => b._id === builderId);
    return builder?.name || 'Unknown';
  };

  const getServiceName = (serviceId: string) => {
    const service = services?.find((s) => s._id === serviceId);
    return service?.name || 'Unknown';
  };

  const getModelPlanName = (modelPlanId: string | null) => {
    if (!modelPlanId) return 'All Models';
    const plan = modelPlans?.find((p) => p._id === modelPlanId);
    return plan?.name || 'Unknown';
  };

  const filteredModelPlans = modelPlans?.filter((p) => p.builderId === selectedBuilderId) || [];

  return (
    <div>
      {/* Header with Add Button */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {rates?.length || 0} rate{rates?.length !== 1 ? 's' : ''} configured
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('contracts.addRate')}
        </button>
      </div>

      {/* Rates Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {!rates || rates.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💵</div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">No rates configured yet</p>
            <button
              onClick={() => openModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Rate
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('common.builder')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('common.service')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('intake.modelPlan')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('contracts.rate')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('contracts.effectiveDate')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-700">
                {rates?.map((rate) => (
                  <tr key={rate._id} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-medium">
                      {getBuilderName(rate.builderId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {getServiceName(rate.serviceId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      <span className={rate.modelPlanId ? '' : 'italic text-gray-500 dark:text-gray-500'}>
                        {getModelPlanName(rate.modelPlanId)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                        <span>💵</span>
                        ${rate.rate}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {new Date(rate.effectiveOn).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openPreviewModal(rate)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-md transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Preview
                        </button>
                        <button
                          onClick={() => openModal(rate)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(rate._id)}
                          disabled={isDeleting === rate._id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting === rate._id ? (
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
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-lg bg-white dark:bg-slate-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-200 dark:border-gray-700">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-semibold leading-6 text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"
                  >
                    <span className="text-2xl">💵</span>
                    {selectedRate ? t('contracts.editRate') : t('contracts.addRate')}
                  </Dialog.Title>

                  <form onSubmit={onSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
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
                        <label htmlFor="serviceId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('common.service')}
                        </label>
                        <select
                          id="serviceId"
                          {...register('serviceId')}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                        >
                          <option value="">-- Select Service --</option>
                          {services?.map((service) => (
                            <option key={service._id} value={service._id}>
                              {service.name}
                            </option>
                          ))}
                        </select>
                        {errors.serviceId && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.serviceId.message}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="modelPlanId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Model/Plan <span className="text-xs text-gray-500">(Optional - leave empty for all models)</span>
                      </label>
                      <select
                        id="modelPlanId"
                        {...register('modelPlanId')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                        disabled={!selectedBuilderId}
                      >
                        <option value="">All Models</option>
                        {filteredModelPlans?.map((plan) => (
                          <option key={plan._id} value={plan._id}>
                            {plan.name}
                          </option>
                        ))}
                      </select>
                      {!selectedBuilderId && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Select a builder first to see model plans</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="rate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Rate Amount
                        </label>
                        <input
                          id="rate"
                          type="number"
                          step="0.01"
                          {...register('rate')}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                          placeholder="0.00"
                        />
                        {errors.rate && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.rate.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="basis" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('contracts.basis')}
                        </label>
                        <select
                          id="basis"
                          {...register('basis')}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                        >
                          <option value="">-- Select --</option>
                          <option value="PER_JOB">Per Job</option>
                          <option value="PER_SQFT">Per Sqft</option>
                          <option value="PER_UNIT">Per Unit</option>
                        </select>
                        {errors.basis && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.basis.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="effectiveOn" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('contracts.effectiveDate')}
                        </label>
                        <input
                          id="effectiveOn"
                          type="date"
                          {...register('effectiveOn')}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                        />
                        {errors.effectiveOn && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.effectiveOn.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="expiresOn" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Expires On <span className="text-xs text-gray-500">(Optional)</span>
                        </label>
                        <input
                          id="expiresOn"
                          type="date"
                          {...register('expiresOn')}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          reset();
                          setSelectedRate(null);
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

      {/* Preview Modal */}
      <Transition appear show={isPreviewOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsPreviewOpen(false)}>
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
                    <span className="text-2xl">🔍</span>
                    Rate Details
                  </Dialog.Title>

                  {selectedRateForPreview && (
                    <div className="space-y-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <div className="space-y-3">
                          <div>
                            <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider">{t('common.builder')}</span>
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mt-1">
                              {getBuilderName(selectedRateForPreview.builderId)}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider">{t('common.service')}</span>
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mt-1">
                              {getServiceName(selectedRateForPreview.serviceId)}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider">{t('intake.modelPlan')}</span>
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mt-1">
                              {getModelPlanName(selectedRateForPreview.modelPlanId)}
                            </p>
                          </div>
                          <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
                            <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider">{t('contracts.rate')}</span>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                              ${selectedRateForPreview.rate}
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                              {selectedRateForPreview.basis}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                        <h4 className="font-semibold text-purple-900 dark:text-purple-300 text-sm mb-2 flex items-center gap-2">
                          <span>💡</span>
                          Rate Resolution Logic
                        </h4>
                        <p className="text-xs text-purple-800 dark:text-purple-200 leading-relaxed">
                          This rate is selected because it is the most specific match for the given builder, service, and model/plan combination. Model-specific rates override general builder rates.
                        </p>
                      </div>

                      <button
                        onClick={() => setIsPreviewOpen(false)}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        {t('common.close')}
                      </button>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
