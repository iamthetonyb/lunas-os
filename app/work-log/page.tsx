'use client';

import { Fragment, useEffect, useMemo, useState, useId } from 'react';
import useSWR from 'swr';
import { Dialog, Transition } from '@headlessui/react';
import { useForm, UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  serviceLogInputSchema,
  type ServiceLogFormValues,
} from '@/lib/validation/service-log';
import dynamic from 'next/dynamic';
import { mutate } from 'swr';
import { UploadButton } from '@/lib/uploadthing-components';
import { useSession } from 'next-auth/react';
import { fetchJSON } from '@/lib/utils/fetch-json';

const OrgRealtimeProvider = dynamic(() => import('@/components/OrgRealtimeProvider'), { ssr: false });

const fetcher = <T,>(url: string) => fetchJSON<T>(url);

type BuilderDTO = { id: string; name: string };
type CommunityDTO = { id: string; name: string };
type ServiceDTO = { id: string; name: string };

type ServiceLog = {
  id: string;
  date: string | null;
  projectName: string | null;
  builder: string | null;
  community: string | null;
  address: string | null;
  lot: string | null;
  unitLot: string | null;
  serviceType: string | null;
  category: string | null;
  hours: string | number | null;
  amount: string | number | null;
  status: string | null;
  timeIn: string | null;
  timeOut: string | null;
  extras: string | null;
  explainWork: string | null;
  team: string[] | null;
  supervisor: string | null;
  foreman: string | null;
  crewLeader: string | null;
  photos: string[] | null;
  source: string | null;
};

export default function WorkLogPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ServiceLog | null>(null);
  const [isEditOpen, setEditOpen] = useState(false);

  // Redirect contractors away from Extra Work page
  const isContractor = session?.user?.role === 'FOREMAN' || session?.user?.role === 'CREW';

  const { data: builderOptions = [] } = useSWR<BuilderDTO[]>('/api/builders', fetcher);
  const { data: communityOptions = [] } = useSWR<CommunityDTO[]>('/api/communities', fetcher);
  const { data: serviceOptions = [] } = useSWR<ServiceDTO[]>('/api/services', fetcher);

  const builderSuggestions = useMemo(
    () => builderOptions.map((builder) => builder.name).filter(Boolean),
    [builderOptions]
  );
  const communitySuggestions = useMemo(
    () => communityOptions.map((community) => community.name).filter(Boolean),
    [communityOptions]
  );
  const serviceSuggestions = useMemo(
    () => serviceOptions.map((service) => service.name).filter(Boolean),
    [serviceOptions]
  );

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (dateFilter) params.set('date', dateFilter);
    return params.toString();
  }, [search, dateFilter]);

  const swrKey = `/api/service-logs${queryString ? `?${queryString}` : ''}`;
  const { data: logs, isLoading } = useSWR<ServiceLog[]>(swrKey, fetcher, {
    revalidateOnFocus: false,
  });

  async function handleDelete(logId: string | undefined | null) {
    if (!logId) {
      console.error('Cannot delete log: ID is missing.');
      alert('Cannot delete log: ID is missing.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this service log?')) {
      return;
    }

    try {
      await fetchJSON(`/api/service-logs/${logId}`, { method: 'DELETE' });
      await mutate(swrKey);
      setEditOpen(false);
    } catch (error) {
      console.error('Failed to delete service log', error);
      alert('Failed to delete service log.');
    }
  }

  // Show access denied for contractors
  if (isContractor) {
    return (
      <main className="px-6 py-6 space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Access Restricted</h2>
          <p className="text-yellow-700">The Extra Work page is only accessible to admin and back office staff.</p>
        </div>
      </main>
    );
  }

  return (
    <OrgRealtimeProvider orgId={session?.user?.orgId ?? undefined}>
      <main className="px-6 py-6 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Extra Work</h1>
            <p className="text-gray-500">Track extra services and additional field activity.</p>
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            <input
              type="search"
              placeholder="Search services..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              + Add Service
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Date</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Address / Lot</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Service</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Hours</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Amount</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Status</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              )}
              {!isLoading && (!logs || logs.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    No service logs match your filters.
                  </td>
                </tr>
              )}
              {logs?.map((log) => (
                <tr
                  key={log.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => {
                    setSelectedLog(log);
                    setEditOpen(true);
                  }}
                >
                  <td className="px-4 py-3 text-gray-900">
                    {log.date ? new Date(log.date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {log.address || '—'}
                    <div className="text-xs text-gray-500">
                      {log.lot ? `Lot ${log.lot}` : ''}
                      {log.unitLot ? ` / Unit ${log.unitLot}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <div className="font-medium">{log.serviceType || '—'}</div>
                    <div className="text-xs text-gray-500">{log.category || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{log.hours ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {log.amount ? `$${Number(log.amount).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                      {log.status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (log.id) handleDelete(log.id);
                      }}
                      disabled={!log.id}
                      className="text-red-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AddServiceDrawer
          open={isDrawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSuccess={async () => {
            await mutate(swrKey);
            setDrawerOpen(false);
          }}
          builderSuggestions={builderSuggestions}
          communitySuggestions={communitySuggestions}
          serviceSuggestions={serviceSuggestions}
        />
        <EditServiceLogModal
          open={isEditOpen}
          log={selectedLog}
          onClose={() => setEditOpen(false)}
          onSuccess={async () => {
            await mutate(swrKey);
            setEditOpen(false);
          }}
          onDelete={() => {
            if (selectedLog?.id) {
              handleDelete(selectedLog.id);
            } else {
              console.error('Cannot delete: selectedLog or selectedLog.id is missing');
              alert('Cannot delete: Log ID is missing.');
            }
          }}
          builderSuggestions={builderSuggestions}
          communitySuggestions={communitySuggestions}
          serviceSuggestions={serviceSuggestions}
        />
      </main>
    </OrgRealtimeProvider>
  );
}

function AddServiceDrawer({
  open,
  onClose,
  onSuccess,
  builderSuggestions,
  communitySuggestions,
  serviceSuggestions,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  builderSuggestions: string[];
  communitySuggestions: string[];
  serviceSuggestions: string[];
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<ServiceLogFormValues>({
    resolver: zodResolver(serviceLogInputSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      team: [],
      photos: [],
    },
  });

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    register('team');
    register('photos');
  }, [register]);

  const onSubmit = handleSubmit(async (data) => {
    const parsed = serviceLogInputSchema.parse({
      ...data,
      date: data.date,
    });
    try {
      await fetchJSON('/api/service-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      reset();
      onSuccess();
    } catch (error) {
      console.error('Failed to save service log', error);
      alert('Failed to save service log.');
    }
  });

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full justify-end">
            <Transition.Child
              as={Fragment}
              enter="transform transition ease-out duration-200"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transform transition ease-in duration-150"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              <Dialog.Panel className="w-full max-w-xl bg-white p-6 shadow-2xl">
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Add Service Log
                </Dialog.Title>
                <p className="text-sm text-gray-500 mb-6">
                  Capture what happened on-site for compliance and invoicing.
                </p>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Project</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="Project / Phase"
                        {...register('projectName')}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Date</label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        {...register('date')}
                      />
                      {errors.date && (
                        <p className="text-xs text-red-600">{errors.date.message}</p>
                      )}
                    </div>
                    <SuggestionInput
                      label="Service Type"
                      name="serviceType"
                      register={register}
                      placeholder="e.g., Final Clean"
                      suggestions={serviceSuggestions}
                    />
                    <div>
                      <label className="text-sm font-medium text-gray-700">Category</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="T1 / T2 / T3"
                        {...register('category')}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Status</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="Pending / Complete"
                        {...register('status')}
                      />
                    </div>
                    <SuggestionInput
                      label="Builder"
                      name="builder"
                      register={register}
                      placeholder="Choose or type builder"
                      suggestions={builderSuggestions}
                    />
                    <SuggestionInput
                      label="Community"
                      name="community"
                      register={register}
                      placeholder="Choose or type community"
                      suggestions={communitySuggestions}
                    />
                    <div>
                      <label className="text-sm font-medium text-gray-700">Address</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        {...register('address')}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Lot / Unit</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="Lot 12"
                        {...register('lot')}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Unit / Building</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="Unit 203"
                        {...register('unitLot')}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Time In</label>
                      <input
                        type="time"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        {...register('timeIn', { setValueAs: (value) => (value || undefined) })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Time Out</label>
                      <input
                        type="time"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        {...register('timeOut', { setValueAs: (value) => (value || undefined) })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Hours</label>
                      <input
                        type="number"
                        step="0.1"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        {...register('hours')}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        {...register('amount')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Supervisor</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        {...register('supervisor')}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Foreman</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        {...register('foreman')}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Crew Leader</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        {...register('crewLeader')}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Team</label>
                    <textarea
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      placeholder="Comma separated names"
                      onChange={(e) =>
                        setValue(
                          'team',
                          e.target.value
                            .split(',')
                            .map((name) => name.trim())
                            .filter(Boolean)
                        )
                      }
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Extras</label>
                    <textarea
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      rows={2}
                      {...register('extras')}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Explain Work</label>
                    <textarea
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      rows={3}
                      {...register('explainWork')}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Photos</label>
                      {uploading && <span className="text-xs text-gray-500">Uploading…</span>}
                    </div>
                    <UploadButton
                      endpoint="imageUploader"
                      onUploadProgress={() => setUploading(true)}
                      onClientUploadComplete={(files) => {
                        setUploading(false);
                        const urls = files?.map((file) => file.url) ?? [];
                        setValue('photos', urls);
                      }}
                      onUploadError={() => setUploading(false)}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Saving…' : 'Save Service'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

function SuggestionInput({
  label,
  name,
  register,
  placeholder,
  suggestions,
}: {
  label: string;
  name: keyof ServiceLogFormValues;
  register: UseFormRegister<ServiceLogFormValues>;
  placeholder?: string;
  suggestions?: string[];
}) {
  const datalistId = useId();
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        list={suggestions && suggestions.length ? datalistId : undefined}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
        {...register(name)}
      />
      {suggestions && suggestions.length > 0 && (
        <datalist id={datalistId}>
          {[...new Set(suggestions)].map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </div>
  );
}

function EditServiceLogModal({
  open,
  log,
  onClose,
  onSuccess,
  onDelete,
  builderSuggestions,
  communitySuggestions,
  serviceSuggestions,
}: {
  open: boolean;
  log: ServiceLog | null;
  onClose: () => void;
  onSuccess: () => void;
  onDelete: () => void;
  builderSuggestions: string[];
  communitySuggestions: string[];
  serviceSuggestions: string[];
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<ServiceLogFormValues>({
    resolver: zodResolver(serviceLogInputSchema),
  });
  const [teamInput, setTeamInput] = useState('');

  useEffect(() => {
    register('team');
    register('photos');
  }, [register]);

  useEffect(() => {
    if (log && open) {
      reset({
        ...log,
        date: log.date ? new Date(log.date).toISOString().split('T')[0] : '',
      });
      const teamText = (log.team ?? []).join(', ');
      setTeamInput(teamText);
      setValue('team', log.team ?? []);
      setValue('photos', log.photos ?? []);
    }
  }, [log, open, reset, setValue]);

  const onSubmit = handleSubmit(async (data) => {
    if (!log) return;
    try {
      await fetchJSON(`/api/service-logs/${log.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to update service log', error);
      alert('Failed to update service log.');
    }
  });

  if (!log) {
    return null;
  }

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="scale-95 opacity-0"
              enterTo="scale-100 opacity-100"
              leave="ease-in duration-150"
              leaveFrom="scale-100 opacity-100"
              leaveTo="scale-95 opacity-0"
            >
              <Dialog.Panel className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-2xl">
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Edit Service Log
                </Dialog.Title>
                <p className="text-sm text-gray-500 mb-6">
                  Review and update the captured details for this work log entry.
                </p>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <SuggestionInput
                      label="Project"
                      name="projectName"
                      register={register}
                      placeholder="Project / Phase"
                    />
                    <div>
                      <label className="text-sm font-medium text-gray-700">Date</label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        {...register('date')}
                      />
                      {errors.date && (
                        <p className="text-xs text-red-600">{errors.date.message}</p>
                      )}
                    </div>
                    <SuggestionInput
                      label="Service Type"
                      name="serviceType"
                      register={register}
                      placeholder="Service performed"
                      suggestions={serviceSuggestions}
                    />
                    <SuggestionInput
                      label="Category"
                      name="category"
                      register={register}
                      placeholder="T1 / T2 / T3"
                    />
                    <SuggestionInput
                      label="Status"
                      name="status"
                      register={register}
                      placeholder="Pending / Complete"
                    />
                    <SuggestionInput
                      label="Builder"
                      name="builder"
                      register={register}
                      placeholder="Choose or type builder"
                      suggestions={builderSuggestions}
                    />
                    <SuggestionInput
                      label="Community"
                      name="community"
                      register={register}
                      placeholder="Choose or type community"
                      suggestions={communitySuggestions}
                    />
                    <SuggestionInput
                      label="Address"
                      name="address"
                      register={register}
                      placeholder="Street address"
                    />
                    <SuggestionInput
                      label="Lot"
                      name="lot"
                      register={register}
                      placeholder="Lot 42"
                    />
                    <SuggestionInput
                      label="Unit / Building"
                      name="unitLot"
                      register={register}
                      placeholder="Unit 203"
                    />
                    <div>
                      <label className="text-sm font-medium text-gray-700">Time In</label>
                      <input
                        type="time"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        {...register('timeIn')}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Time Out</label>
                      <input
                        type="time"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        {...register('timeOut')}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Hours</label>
                      <input
                        type="number"
                        step="0.1"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        {...register('hours')}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        {...register('amount')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <SuggestionInput
                      label="Supervisor"
                      name="supervisor"
                      register={register}
                      placeholder="Supervisor name"
                    />
                    <SuggestionInput
                      label="Foreman"
                      name="foreman"
                      register={register}
                      placeholder="Foreman name"
                    />
                    <SuggestionInput
                      label="Crew Leader"
                      name="crewLeader"
                      register={register}
                      placeholder="Crew leader name"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Team</label>
                    <textarea
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      value={teamInput}
                      onChange={(event) => {
                        const value = event.target.value;
                        setTeamInput(value);
                        setValue(
                          'team',
                          value
                            .split(',')
                            .map((member) => member.trim())
                            .filter(Boolean)
                        );
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Extras</label>
                    <textarea
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      rows={2}
                      {...register('extras')}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Explain Work</label>
                    <textarea
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      rows={3}
                      {...register('explainWork')}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Photos</label>
                    </div>
                    <UploadButton
                      endpoint="imageUploader"
                      onUploadProgress={() => { }}
                      onClientUploadComplete={(files) => {
                        const urls = files?.map((file) => file.url) ?? [];
                        setValue('photos', urls);
                      }}
                      onUploadError={() => {
                        // ignore upload errors for edit form
                      }}
                    />
                  </div>

                  <div className="flex justify-between gap-2 pt-4">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-100 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-200"
                      onClick={onDelete}
                    >
                      Delete
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSubmitting ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
