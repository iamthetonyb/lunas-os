'use client';

import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import useSWR, { mutate } from 'swr';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
} from 'react';
import dayjs from 'dayjs';
import { fetchJSON } from '@/lib/utils/fetch-json';
import { SearchableSelect, SearchableMultiSelect, type SelectOption } from './searchable-select';

const REQUESTED_BY_LIST = ['Anahi', 'Chayo', 'Blanca', 'Raudel', 'Francisco'] as const;
type RequestedByName = (typeof REQUESTED_BY_LIST)[number];

const baseSchema = z.object({
  communityId: z.string().min(1, 'Community is required'),
  builderId: z.string().min(1, 'Builder is required'),
  lot: z.string().min(1, 'Lot number is required'),
  address: z.string().optional().or(z.literal('')),
  modelPlanId: z.string().optional(),
  serviceIds: z.array(z.string()).min(1, 'Select at least one service'),
  dueDate: z.string().min(1, 'Due date is required'),
  walkTime: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.any().optional(),
  requestedBy: z
    .string()
    .min(1, 'Requested by is required')
    .refine((value) => REQUESTED_BY_LIST.includes(value as RequestedByName), {
      message: 'Select a valid requester',
    }),
  contact: z.string().min(1, 'Contact information is required'),
  poNumber: z.string().optional(),
});

const schema = baseSchema;

type FormData = z.infer<typeof baseSchema>;

const fetcher = async <T,>(url: string): Promise<T> => {
  try {
    return await fetchJSON<T>(url);
  } catch (error) {
    console.error('Fetcher error for', url, error);
    return ([] as unknown) as T;
  }
};

type SelectOption = {
  value: string;
  label: string;
  description?: string;
  variant?: 'default' | 'danger';
  requiresNotes?: boolean;
};

type BuilderDTO = {
  id: string;
  name: string;
};

type CommunityDTO = {
  id: string;
  name: string;
  builderId?: string | null;
};

type ModelPlanDTO = {
  id: string;
  name: string;
  builderId?: string | null;
  code?: string | null;
  defaults?: Record<string, unknown> | null;
};

type ServiceDTO = {
  id: string;
  name: string;
  code?: string | null;
};

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  emptyStateLabel?: string;
};



export function IntakeForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: builders } = useSWR<BuilderDTO[]>('/api/builders', fetcher);
  const { data: communities } = useSWR<CommunityDTO[]>('/api/communities', fetcher);
  const { data: modelPlans } = useSWR<ModelPlanDTO[]>('/api/model-plans', fetcher);
  const { data: services } = useSWR<ServiceDTO[]>('/api/services', fetcher);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
    setError,
    clearErrors,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      communityId: '',
      builderId: '',
      modelPlanId: '',
      lot: '',
      address: '',
      serviceIds: [],
      dueDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
      walkTime: '',
      notes: '',
      requestedBy: '',
      contact: '',
      poNumber: '',
    }
  });

  const builderId = useWatch({ control, name: 'builderId' });
  const communityId = useWatch({ control, name: 'communityId' });
  const modelPlanId = useWatch({ control, name: 'modelPlanId' });
  const selectedServiceIds = useWatch({ control, name: 'serviceIds' }) ?? [];

  const serviceOptions = useMemo<SelectOption[]>(() => {
    if (!services) return [];
    return services.map((service) => {
      const normalized = service.name.toLowerCase();
      const description = service.code ? `Code: ${service.code}` : undefined;
      const label = service.name;
      const requiresNotes = normalized.includes('extra');
      const variant = requiresNotes ? 'danger' : undefined;
      return {
        value: service.id,
        label,
        description,
        variant,
        requiresNotes,
      };
    });
  }, [services]);

  const serviceOptionMap = useMemo(() => {
    const map = new Map<string, SelectOption>();
    serviceOptions.forEach((option) => map.set(option.value, option));
    return map;
  }, [serviceOptions]);

  const extraWorkSelected = useMemo(
    () =>
      selectedServiceIds.some(
        (serviceId) => serviceOptionMap.get(serviceId)?.requiresNotes
      ),
    [selectedServiceIds, serviceOptionMap]
  );

  const builderOptions = useMemo<SelectOption[]>(
    () =>
      (builders ?? []).map((builder) => ({
        value: builder.id,
        label: builder.name,
      })),
    [builders]
  );

  const builderMap = useMemo(() => {
    const map = new Map<string, string>();
    (builders ?? []).forEach((builder) => {
      map.set(builder.id, builder.name);
    });
    return map;
  }, [builders]);

  const communityOptions = useMemo(() => {
    return (communities ?? []).map((community) => ({
      value: community.id,
      label: community.name,
      description: builderMap.get(community.builderId ?? '') ?? undefined,
    }));
  }, [communities, builderMap]);

  const communityMap = useMemo(() => {
    const map = new Map<string, CommunityDTO>();
    (communities ?? []).forEach((community) => {
      map.set(community.id, community);
    });
    return map;
  }, [communities]);

  const modelPlanOptions = useMemo(() => {
    if (!modelPlans) return [] as SelectOption[];
    const filtered = builderId
      ? modelPlans.filter((plan) => plan.builderId === builderId)
      : modelPlans;
    return filtered.map((plan) => ({
      value: plan.id,
      label: plan.name,
      description: plan.code ?? undefined,
    }));
  }, [modelPlans, builderId]);

  const requestedByOptions = useMemo<SelectOption[]>(
    () => REQUESTED_BY_LIST.map((name) => ({ value: name, label: name })),
    []
  );



  useEffect(() => {
    if (!modelPlanId) return;
    if (!modelPlans || modelPlans.length === 0) return;
    const plan = modelPlans.find((item) => item.id === modelPlanId);
    if (!plan) {
      setValue('modelPlanId', '', { shouldValidate: true });
      return;
    }
    if (builderId && plan.builderId && plan.builderId !== builderId) {
      setValue('modelPlanId', '', { shouldValidate: true });
    }
  }, [builderId, modelPlanId, modelPlans, setValue]);

  useEffect(() => {
    if (builderId && modelPlanId) {
      const modelPlan = modelPlans?.find((plan) => plan.id === modelPlanId);
      if (modelPlan?.defaults) {
        Object.entries(modelPlan.defaults).forEach(([key, value]) => {
          if (key in baseSchema.shape) {
            setValue(key as keyof FormData, value as FormData[keyof FormData]);
          }
        });
      }
    }
  }, [builderId, modelPlanId, modelPlans, setValue]);

  useEffect(() => {
    if (!extraWorkSelected) {
      clearErrors('notes');
    }
  }, [extraWorkSelected, clearErrors]);

  const onSubmit = handleSubmit(async (data) => {
    const requiresNotes = data.serviceIds.some(
      (serviceId) => serviceOptionMap.get(serviceId)?.requiresNotes
    );
    if (requiresNotes && (!data.notes || !data.notes.trim())) {
      setError('notes', {
        type: 'manual',
        message: 'Notes are required when Extra Work is selected.',
      });
      return;
    }
    clearErrors('notes');
    try {
      await fetchJSON('/api/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      await mutate('/api/job-requests/recent');
      router.push('/intake');
    } catch (error) {
      console.error('Error creating job request:', error);
      alert('Error creating job request. Please try again.');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Builder & Community Section */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
          📍 Builder & Location Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('community')} <span className="text-red-500">*</span>
            </label>
            <Controller
              control={control}
              name="communityId"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={communityOptions}
                  placeholder="Start typing community name..."
                  disabled={!communityOptions.length}
                  emptyStateLabel="No communities found"
                />
              )}
            />
            {errors.communityId && (
              <p className="mt-1 text-sm text-red-600">{errors.communityId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('builder')} <span className="text-red-500">*</span>
            </label>
            <Controller
              control={control}
              name="builderId"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={builderOptions}
                  placeholder="Search builder..."
                  disabled={!builderOptions.length}
                  emptyStateLabel="No builders found"
                />
              )}
            />
            {errors.builderId && (
              <p className="mt-1 text-sm text-red-600">{errors.builderId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('modelPlan')}
            </label>
            <Controller
              control={control}
              name="modelPlanId"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={modelPlanOptions}
                  placeholder="Search model plans..."
                  disabled={!modelPlanOptions.length}
                  emptyStateLabel={builderId ? 'No model plans for this builder' : 'Select a builder first'}
                />
              )}
            />
          </div>

          <div>
            <label htmlFor="lot" className="block text-sm font-medium text-gray-700 mb-2">
              {t('lot')} <span className="text-red-500">*</span>
            </label>
            <input 
              id="lot" 
              {...register('lot')}
              placeholder="e.g., Lot 123"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {errors.lot && (
              <p className="mt-1 text-sm text-red-600">{errors.lot.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
              {t('address')}
            </label>
            <input 
              id="address" 
              {...register('address')}
              placeholder="Full street address"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {errors.address && (
              <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Services Section */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
          🛠️ Services Required <span className="text-red-500">*</span>
        </h3>
        
        <Controller
          control={control}
          name="serviceIds"
          render={({ field }) => (
            <SearchableMultiSelect
              value={field.value ?? []}
              onChange={field.onChange}
              options={serviceOptions}
              placeholder="Search and select services..."
              disabled={!serviceOptions.length}
            />
          )}
        />
        {errors.serviceIds && (
          <p className="mt-2 text-sm text-red-600">{errors.serviceIds.message}</p>
        )}
      </div>

      {/* Schedule Section */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
          📅 Schedule Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
              {t('dueDate')} <span className="text-red-500">*</span>
            </label>
            <input 
              id="dueDate" 
              type="date" 
              {...register('dueDate')}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {errors.dueDate && (
              <p className="mt-1 text-sm text-red-600">{errors.dueDate.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="walkTime" className="block text-sm font-medium text-gray-700 mb-2">
              {t('walkTime')}
            </label>
            <input 
              id="walkTime" 
              type="time"
              {...register('walkTime')}
              placeholder="e.g., 2:00 PM"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Contact Information Section */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
          👤 Contact Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="requestedBy" className="block text-sm font-medium text-gray-700 mb-2">
              {t('requestedBy')} <span className="text-red-500">*</span>
            </label>
            <Controller
              control={control}
              name="requestedBy"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={requestedByOptions}
                  placeholder="Select requester"
                  disabled={requestedByOptions.length === 0}
                  emptyStateLabel="No matches"
                />
              )}
            />
            {errors.requestedBy && (
              <p className="mt-1 text-sm text-red-600">{errors.requestedBy.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-2">
              {t('contact')} <span className="text-red-500">*</span>
            </label>
            <input 
              id="contact" 
              {...register('contact')}
              placeholder="Phone or email"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {errors.contact && (
              <p className="mt-1 text-sm text-red-600">{errors.contact.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="poNumber" className="block text-sm font-medium text-gray-700 mb-2">
              {t('poNumber')}
            </label>
            <input 
              id="poNumber" 
              {...register('poNumber')}
              placeholder="Purchase Order Number"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
          📝 Additional Notes
        </h3>
        
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            {t('notes')} {extraWorkSelected && <span className="text-red-500">*</span>}
          </label>
          <textarea 
            id="notes" 
            {...register('notes')}
            rows={4}
            placeholder="Any additional information or special instructions..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
          {extraWorkSelected && (
            <p className="mt-1 text-xs text-red-500">
              Notes are required when submitting Extra Work.
            </p>
          )}
          {errors.notes && (
            <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-4 pt-4">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Intake Request'}
        </button>
      </div>
    </form>
  );
}
