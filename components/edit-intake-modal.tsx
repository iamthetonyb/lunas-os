'use client';

import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import {
  useEffect,
  useMemo,
  Fragment,
} from 'react';
import dayjs from 'dayjs';
import { fetchJSON } from '@/lib/utils/fetch-json';
import { Dialog, Transition } from '@headlessui/react';
import type { RecentIntake } from '@/app/intake/page';
import { SearchableSelect, SearchableMultiSelect, type SelectOption } from './searchable-select';

const fetcher = async <T,>(url: string): Promise<T> => {
  try {
    return await fetchJSON<T>(url);
  } catch (error) {
    console.error('Fetcher error for', url, error);
    return [] as unknown as T;
  }
};

type BuilderDTO = { id: string; name: string };
type CommunityDTO = { id: string; name: string; builderId?: string | null };
type ModelPlanDTO = { id: string; name: string; builderId?: string | null; code?: string | null };
type ServiceDTO = { id: string; name: string; code?: string | null };

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
  requestedBy: z
    .string()
    .min(1, 'Requested by is required')
    .refine((value) => REQUESTED_BY_LIST.includes(value as RequestedByName), {
      message: 'Select a valid requester',
    }),
  contact: z.string().min(1, 'Contact information is required'),
  poNumber: z.string().optional(),
});

type FormData = z.infer<typeof baseSchema>;


function EditIntakeForm({ intake, onSuccess, onClose }: { intake: RecentIntake; onSuccess: () => void; onClose: () => void; }) {
  const { t } = useTranslation();
  
  // CRITICAL: All hooks MUST be called unconditionally at the top level before any returns
  // to comply with React Rules of Hooks. Moving data fetching hooks here.
  const { data: builders } = useSWR<BuilderDTO[]>('/api/builders', fetcher);
  const { data: communities } = useSWR<CommunityDTO[]>('/api/communities', fetcher);
  const { data: modelPlans } = useSWR<ModelPlanDTO[]>('/api/model-plans', fetcher);
  const { data: services } = useSWR<ServiceDTO[]>('/api/services', fetcher);

  // Initialize form with useForm hook - MUST be called unconditionally
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
    setError,
    clearErrors,
  } = useForm<FormData>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      communityId: intake.communityId ?? '',
      builderId: intake.builderId ?? '',
      lot: intake.lot ?? '',
      address: intake.address ?? '',
      modelPlanId: intake.modelPlanId ?? '',
      serviceIds: intake.services?.map((s) => s.id) ?? [],
      dueDate: intake.dueDate ? dayjs(intake.dueDate).format('YYYY-MM-DD') : '',
      walkTime: intake.services?.[0]?.walkTime || '',
      notes: intake.notes ?? '',
      requestedBy: intake.requestedBy ?? '',
      contact: intake.contact ?? '',
      poNumber: intake.poNumber ?? '',
    },
  });

  // All useWatch hooks must also be called unconditionally
  const builderId = useWatch({ control, name: 'builderId' });
  const modelPlanId = useWatch({ control, name: 'modelPlanId' });
  const selectedServiceIds = useWatch({ control, name: 'serviceIds' }) ?? [];

  // All useMemo hooks must be called unconditionally
  const serviceOptions = useMemo<SelectOption[]>(() => {
    if (!services) return [];
    return services.map((service) => {
      const normalized = service.name.toLowerCase();
      const description = service.code ? `Code: ${service.code}` : undefined;
      const label = service.name;
      const requiresNotes = normalized.includes('extra');
      const variant = requiresNotes ? 'danger' : undefined;
      return { value: service.id, label, description, variant, requiresNotes };
    });
  }, [services]);

  const serviceOptionMap = useMemo(() => {
    const map = new Map<string, SelectOption>();
    serviceOptions.forEach((option) => map.set(option.value, option));
    return map;
  }, [serviceOptions]);

  const extraWorkSelected = useMemo(
    () => selectedServiceIds.some((serviceId) => serviceOptionMap.get(serviceId)?.requiresNotes),
    [selectedServiceIds, serviceOptionMap]
  );

  const builderOptions = useMemo<SelectOption[]>(() => (builders ?? []).map((builder) => ({ value: builder.id, label: builder.name })), [builders]);
  const communityOptions = useMemo(() => (communities ?? []).map((community) => ({ value: community.id, label: community.name })), [communities]);
  const modelPlanOptions = useMemo(() => {
    if (!modelPlans) return [];
    const filtered = builderId ? modelPlans.filter((plan) => plan.builderId === builderId) : modelPlans;
    return filtered.map((plan) => ({ value: plan.id, label: plan.name, description: plan.code ?? undefined }));
  }, [modelPlans, builderId]);
  const requestedByOptions = useMemo<SelectOption[]>(() => REQUESTED_BY_LIST.map((name) => ({ value: name, label: name })), []);

  // All useEffect hooks must be called unconditionally
  useEffect(() => {
    if (!modelPlanId) return;
    if (!modelPlans || modelPlans.length === 0) return;
    const plan = modelPlans.find((item) => item.id === modelPlanId);
    if (!plan) {
      setValue('modelPlanId', '');
      return;
    }
    if (builderId && plan.builderId && plan.builderId !== builderId) {
      setValue('modelPlanId', '');
    }
  }, [builderId, modelPlanId, modelPlans, setValue]);

  useEffect(() => {
    if (!extraWorkSelected) {
      clearErrors('notes');
    }
  }, [extraWorkSelected, clearErrors]);

  // AFTER all hooks are called, we can conditionally render the UI
  // This ensures hook order remains consistent across renders
  if (!builders || !communities || !modelPlans || !services) {
    return <div className="flex items-center justify-center py-8 text-gray-500">Loading form data...</div>;
  }

  const onSubmit = handleSubmit(async (data) => {
    const requiresNotes = data.serviceIds.some((serviceId) => serviceOptionMap.get(serviceId)?.requiresNotes);
    if (requiresNotes && (!data.notes || !data.notes.trim())) {
      setError('notes', { type: 'manual', message: 'Notes are required when Extra Work is selected.' });
      return;
    }
    clearErrors('notes');
    try {
      await fetchJSON(`/api/job-requests/${intake.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      onSuccess();
    } catch (error) {
      console.error('Error updating job request:', error);
      alert('Error updating job request. Please try again.');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Community</label>
          <Controller name="communityId" control={control} render={({ field }) => <SearchableSelect {...field} options={communityOptions} placeholder="Community" />} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Builder</label>
          <Controller name="builderId" control={control} render={({ field }) => <SearchableSelect {...field} options={builderOptions} placeholder="Builder" />} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Model/Plan</label>
          <Controller name="modelPlanId" control={control} render={({ field }) => <SearchableSelect {...field} options={modelPlanOptions} placeholder="Model/Plan" />} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lot</label>
          <input {...register('lot')} placeholder="Lot" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input {...register('address')} placeholder="Address" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Services</label>
        <Controller name="serviceIds" control={control} render={({ field }) => <SearchableMultiSelect {...field} options={serviceOptions} placeholder="Services" />} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
          <input type="date" {...register('dueDate')} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Walk-thru Time</label>
          <input type="time" {...register('walkTime')} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Requested By</label>

          <Controller name="requestedBy" control={control} render={({ field }) => <SearchableSelect {...field} options={requestedByOptions} placeholder="Requested By" />} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
          <input {...register('contact')} placeholder="Contact" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
          <input {...register('poNumber')} placeholder="PO Number" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea {...register('notes')} placeholder="Notes" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" />
      </div>
      <div className="flex justify-end gap-4 pt-4">
        <button type="button" onClick={onClose} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-blue-600 text-white rounded-lg">{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
      </div>
    </form>
  );
}

export function EditIntakeModal({ intake, open, onClose, onSuccess }: { intake: RecentIntake | null; open: boolean; onClose: () => void; onSuccess: () => void; }) {
  if (!intake) return null;
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">Edit Intake</Dialog.Title>
                <EditIntakeForm intake={intake} onSuccess={onSuccess} onClose={onClose} />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}