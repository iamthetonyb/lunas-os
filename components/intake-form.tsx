'use client';

import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import dayjs from 'dayjs';
import { useConvexUser } from '@/hooks/useConvexUser';
import { SearchableSelect, SearchableMultiSelect } from './searchable-select';
import { getFriendlyName } from '@/lib/utils/community-display';

// Empty fallback while foreman query loads
const FALLBACK_REQUESTED_BY: string[] = [];

// Walk time options - top of hour only
const WALK_TIME_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select time...' },
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '18:00', label: '6:00 PM' },
];

type CommunityLotDTO = {
  id: string;
  lotNumber: string;
  jobNumber: string;
  address?: string | null;
};

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
    .min(1, 'Requested by is required'),
  contact: z.string().min(1, 'Contact information is required'),
  poNumber: z.string().optional(),
});

const schema = baseSchema;

type FormData = z.infer<typeof baseSchema>;

type SelectOption = {
  value: string;
  label: string;
  description?: string;
  variant?: 'default' | 'danger';
  requiresNotes?: boolean;
};

export function IntakeForm() {
  const router = useRouter();
  const { t } = useTranslation();

  // Convex queries (reactive, auto-updating)
  const builders = useQuery(api.queries.getBuilders, {}) ?? [];
  const communities = useQuery(api.queries.getCommunities, {}) ?? [];
  const modelPlans = useQuery(api.queries.getModelPlans, {}) ?? [];
  const services = useQuery(api.queries.getServices, {}) ?? [];
  const allUsers = useQuery(api.queries.getUsers, { limit: 100 });

  // Dynamic foreman list from Convex users table
  const foremanNames = useMemo(() => {
    if (!allUsers) return FALLBACK_REQUESTED_BY;
    const names = allUsers
      .filter((u: any) => u.systemRole === 'FOREMAN')
      .map((u: any) => u.name)
      .filter(Boolean)
      .sort();
    return names.length > 0 ? names : FALLBACK_REQUESTED_BY;
  }, [allUsers]);

  const createJobRequest = useMutation(api.mutations.createJobRequest);
  const createCommunity = useMutation(api.mutations.createCommunity);
  const createBuilder = useMutation(api.mutations.createBuilder);
  const createLot = useMutation(api.communityLots.create);
  const convex = useConvex();

  const [duplicateWarning, setDuplicateWarning] = useState<{
    duplicates: string[];
    existingJobCount: number;
    formData: FormData;
  } | null>(null);

  const { data: session } = useConvexUser();
  const isContractor = session?.user?.role === 'FOREMAN' || session?.user?.role === 'CREW';

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

  // Move watches up to fix lint
  const watchedRequestedBy = useWatch({ control, name: 'requestedBy' });
  const watchedCommunityId = useWatch({ control, name: 'communityId' });
  const builderId = useWatch({ control, name: 'builderId' });
  const communityId = useWatch({ control, name: 'communityId' });
  const modelPlanId = useWatch({ control, name: 'modelPlanId' });
  const selectedServiceIds = useWatch({ control, name: 'serviceIds' }) ?? [];

  // Conditional Convex queries
  const foremanContactData = useQuery(
    api.userFunctions.getForemanContact,
    watchedRequestedBy ? { name: watchedRequestedBy } : 'skip'
  );

  const communityLots = useQuery(
    api.communityLots.byCommunity,
    watchedCommunityId ? { communityId: watchedCommunityId as Id<"communities"> } : 'skip'
  ) ?? [];

  // Set default requestedBy for contractors
  useEffect(() => {
    if (isContractor && session?.user?.name && !watchedRequestedBy) {
      const myName = foremanNames.find((n: string) => n.toLowerCase() === session.user.name!.toLowerCase());
      if (myName) {
        setValue('requestedBy', myName, { shouldValidate: true });
      }
    }
  }, [isContractor, session?.user?.name, setValue, watchedRequestedBy, foremanNames]);

  // Lot options from scraped data
  const lotOptions = useMemo<SelectOption[]>(() => {
    if (!communityLots || communityLots.length === 0) return [];
    return communityLots.map((lot: any) => ({
      value: lot.lotNumber,
      label: `Lot ${lot.lotNumber}`,
      description: lot.address ?? lot.jobNumber,
    }));
  }, [communityLots]);

  const serviceOptions = useMemo<SelectOption[]>(() => {
    if (!services) return [];
    return services.map((service: any) => {
      const normalized = service.name.toLowerCase();
      const description = service.code ? `Code: ${service.code}` : undefined;
      const label = service.name;
      const requiresNotes = normalized.includes('extra');
      const variant = requiresNotes ? 'danger' : undefined;
      return {
        value: service._id,
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
      builders.map((builder: any) => ({
        value: builder._id,
        label: builder.name,
      })),
    [builders]
  );

  const builderMap = useMemo(() => {
    const map = new Map<string, string>();
    builders.forEach((builder: any) => {
      map.set(builder._id, builder.name);
    });
    return map;
  }, [builders]);

  const communityOptions = useMemo(() => {
    // Show communities matching selected builder, OR communities with no builder assigned
    const filtered = builderId
      ? communities.filter((c: any) => c.builderId === builderId || !c.builderId)
      : communities;
    return filtered.map((community: any) => ({
      value: community._id,
      label: `${getFriendlyName(community.name)} (${builderMap.get(community.builderId ?? '') ?? 'Unknown'})`,
      description: builderMap.get(community.builderId ?? '') ?? undefined,
    }));
  }, [communities, builderMap, builderId]);

  const communityMap = useMemo(() => {
    const map = new Map<string, any>();
    communities.forEach((community: any) => {
      map.set(community._id, community);
    });
    return map;
  }, [communities]);

  const handleCreateCommunity = useCallback(async (name: string) => {
    try {
      const result = await createCommunity({
        name,
        builderId: builderId ? builderId as Id<'builders'> : undefined,
      });
      toast.success(`Community "${name}" created`);
      return result.id as string;
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create community');
    }
  }, [createCommunity, builderId]);

  const handleCreateBuilder = useCallback(async (name: string) => {
    try {
      const result = await createBuilder({ name });
      toast.success(`Builder "${name}" created`);
      return result.id as string;
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create builder');
    }
  }, [createBuilder]);

  const handleCreateLot = useCallback(async (lotNumber: string) => {
    if (!communityId) {
      toast.error('Select a community first');
      return;
    }
    try {
      await createLot({
        communityId: communityId as Id<'communities'>,
        lotNumber,
        modelPlanId: modelPlanId ? modelPlanId as Id<'modelPlans'> : undefined,
      });
      toast.success(`Lot ${lotNumber} created`);
      return lotNumber;
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create lot');
    }
  }, [createLot, communityId, modelPlanId]);

  const modelPlanOptions = useMemo(() => {
    if (!modelPlans) return [] as SelectOption[];
    let filtered = modelPlans;
    // Filter by community first (most specific), then by builder
    if (communityId) {
      const communityPlans = modelPlans.filter((plan: any) => plan.communityId === communityId);
      if (communityPlans.length > 0) {
        filtered = communityPlans;
      } else if (builderId) {
        filtered = modelPlans.filter((plan: any) => plan.builderId === builderId);
      }
    } else if (builderId) {
      filtered = modelPlans.filter((plan: any) => plan.builderId === builderId);
    }
    return filtered.map((plan: any) => ({
      value: plan._id,
      label: `${plan.name}${plan.sqft ? ` (${plan.sqft} sqft)` : ''}`,
      description: plan.code ?? undefined,
    }));
  }, [modelPlans, builderId, communityId]);

  const requestedByOptions = useMemo<SelectOption[]>(
    () => foremanNames.map((name: string) => ({ value: name, label: name })),
    [foremanNames]
  );

  useEffect(() => {
    if (!modelPlanId) return;
    if (!modelPlans || modelPlans.length === 0) return;
    const plan = modelPlans.find((item: any) => item._id === modelPlanId);
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
      const modelPlan = modelPlans?.find((plan: any) => plan._id === modelPlanId);
      if (modelPlan?.defaults) {
        const defaults = typeof modelPlan.defaults === 'string' ? JSON.parse(modelPlan.defaults) : modelPlan.defaults;
        Object.entries(defaults).forEach(([key, value]) => {
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

  // Clear community when builder changes (community may not belong to new builder)
  useEffect(() => {
    if (builderId && communityId) {
      const community = communityMap.get(communityId);
      // If the selected community doesn't match the new builder, clear it
      if (community?.builderId && community.builderId !== builderId) {
        setValue('communityId', '', { shouldValidate: false });
      }
    }
  }, [builderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-populate builder when community is selected
  useEffect(() => {
    if (communityId) {
      const community = communityMap.get(communityId);
      if (community?.builderId && community.builderId !== builderId) {
        setValue('builderId', community.builderId, { shouldValidate: true });
      }
    }
  }, [communityId, communityMap, builderId, setValue]);

  // Auto-populate contact info based on foreman/requestedBy selection
  useEffect(() => {
    if (foremanContactData) {
      const contact = foremanContactData.phone || foremanContactData.email || '';
      if (contact) {
        setValue('contact', contact, { shouldValidate: true });
      }
    }
  }, [foremanContactData, setValue]);

  const submitJobRequest = useCallback(async (data: FormData, forceExtraWork = false) => {
    const requiresNotes = data.serviceIds.some(
      (serviceId) => serviceOptionMap.get(serviceId)?.requiresNotes
    );
    try {
      const serviceEntries = data.serviceIds.map((serviceId) => {
        const svc = services.find((s: any) => s._id === serviceId);
        return {
          serviceId: serviceId as Id<"services">,
          serviceName: svc?.name ?? 'Unknown Service',
          walkTime: data.walkTime || undefined,
        };
      });

      await createJobRequest({
        builderId: data.builderId as Id<"builders">,
        communityId: data.communityId as Id<"communities">,
        lot: data.lot,
        address: data.address || undefined,
        modelPlanId: data.modelPlanId ? data.modelPlanId as Id<"modelPlans"> : undefined,
        dueDate: data.dueDate,
        notes: data.notes || undefined,
        poNumber: data.poNumber || undefined,
        requestedBy: data.requestedBy,
        contactPhone: data.contact,
        contactEmail: undefined,
        isExtraWork: forceExtraWork || requiresNotes ? true : undefined,
        services: serviceEntries,
      });

      toast.success(t('intake.submitSuccess', 'Job request created successfully!'));
      router.push('/intake');
    } catch (error) {
      console.error('Error creating job request:', error);
      toast.error(t('intake.submitError', 'Failed to create job request. Please try again.'));
    }
  }, [services, serviceOptionMap, createJobRequest, router, t]);

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

    // Check for duplicate services at the same community + lot
    const serviceNames = data.serviceIds
      .map((serviceId) => services.find((s: any) => s._id === serviceId)?.name ?? '')
      .filter(Boolean);

    try {
      const dupCheck = await convex.query(api.jobRequests.checkDuplicateServices, {
        communityId: data.communityId as Id<"communities">,
        lot: data.lot,
        serviceNames,
      });

      if (dupCheck.hasDuplicates) {
        setDuplicateWarning({
          duplicates: dupCheck.duplicates,
          existingJobCount: dupCheck.existingJobCount ?? 0,
          formData: data,
        });
        return;
      }
    } catch (err) {
      console.warn('Duplicate check failed, proceeding with submission:', err);
    }

    await submitJobRequest(data);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Builder & Community Section */}
      <div className="bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          {t('intake.builderLocation')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('intake.community')} <span className="text-red-500">*</span>
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
                  disabled={false}
                  emptyStateLabel="No communities found"
                  allowCreate
                  onCreateOption={handleCreateCommunity}
                  createLabel="Create community"
                />
              )}
            />
            {errors.communityId && (
              <p className="mt-1 text-sm text-red-600">{errors.communityId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('intake.builder')} <span className="text-red-500">*</span>
            </label>
            <Controller
              control={control}
              name="builderId"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={builderOptions}
                  placeholder={t('intake.selectBuilder')}
                  disabled={false}
                  emptyStateLabel={t('intake.noBuilders', 'No builders found')}
                  allowCreate
                  onCreateOption={handleCreateBuilder}
                  createLabel={t('intake.createBuilder', 'Create builder')}
                />
              )}
            />
            {errors.builderId && (
              <p className="mt-1 text-sm text-red-600">{errors.builderId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('intake.modelPlan')}
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
            <label htmlFor="lot" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('intake.lot')} <span className="text-red-500">*</span>
            </label>
            <Controller
              control={control}
              name="lot"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={lotOptions}
                  placeholder={t('intake.lotPlaceholder', 'Type or select lot number...')}
                  disabled={false}
                  emptyStateLabel={communityId ? t('intake.noLots', 'No lots found — type to add') : t('intake.selectCommunityFirst', 'Select a community first')}
                  allowCreate
                  onCreateOption={handleCreateLot}
                  createLabel={t('intake.createLot', 'Add lot')}
                />
              )}
            />
            {errors.lot && (
              <p className="mt-1 text-sm text-red-600">{errors.lot.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('intake.address', 'Address')}
            </label>
            <input
              id="address"
              {...register('address')}
              placeholder="Full street address"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 dark:text-white"
            />
            {errors.address && (
              <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Services Section */}
      <div className="bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          {t('intake.services')} <span className="text-red-500">*</span>
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
      <div className="bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          {t('intake.scheduleInfo')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('intake.dueDate')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="dueDate"
                type="date"
                {...register('dueDate')}
                className="w-full px-4 py-2.5 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 dark:text-white cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
            </div>
            {errors.dueDate && (
              <p className="mt-1 text-sm text-red-600">{errors.dueDate.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="walkTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('intake.walkTime', 'Walk Time')}
            </label>
            <select
              id="walkTime"
              {...register('walkTime')}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 dark:text-white"
            >
              {WALK_TIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Contact Information Section */}
      <div className="bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          {t('intake.contactInfo')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="requestedBy" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('intake.requestedBy')} <span className="text-red-500">*</span>
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
                  disabled={isContractor || requestedByOptions.length === 0}
                  emptyStateLabel="No matches"
                />
              )}
            />
            {errors.requestedBy && (
              <p className="mt-1 text-sm text-red-600">{errors.requestedBy.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="contact" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('intake.contact')} <span className="text-red-500">*</span>
            </label>
            <input
              id="contact"
              {...register('contact')}
              placeholder="Phone or email"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 dark:text-white"
            />
            {errors.contact && (
              <p className="mt-1 text-sm text-red-600">{errors.contact.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="poNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('intake.poNumber')}
            </label>
            <input
              id="poNumber"
              {...register('poNumber')}
              placeholder="Purchase Order Number"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          {t('intake.additionalNotes')}
        </h3>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('intake.notes')} {extraWorkSelected && <span className="text-red-500">*</span>}
          </label>
          <textarea
            id="notes"
            {...register('notes')}
            rows={4}
            spellCheck="true"
            placeholder="Any additional information or special instructions..."
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 dark:text-white resize-none"
          />
          {extraWorkSelected && (
            <p className="mt-1 text-xs text-red-500">
              {t('intake.notesRequired')}
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
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          {isSubmitting ? t('intake.submitting') : t('intake.submitIntake')}
        </button>
      </div>

      {/* Duplicate Service Warning Dialog */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('intake.duplicateWarningTitle', 'Duplicate Services Detected')}
              </h3>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              {t('intake.duplicateWarningBody', {
                count: duplicateWarning.existingJobCount,
                defaultValue: `This lot already has {{count}} existing job(s) with the same services:`,
              })}
            </p>

            <ul className="mb-4 space-y-1">
              {duplicateWarning.duplicates.map((name) => (
                <li key={name} className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                  </svg>
                  {name}
                </li>
              ))}
            </ul>

            <p className="text-sm text-gray-500 mb-5">
              {t('intake.duplicateWarningExtra', 'Submitting will mark this as Extra Work and must be invoiced separately.')}
            </p>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const data = duplicateWarning.formData;
                  setDuplicateWarning(null);
                  await submitJobRequest(data, true);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
              >
                {t('intake.confirmExtraWork', 'Confirm as Extra Work')}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
