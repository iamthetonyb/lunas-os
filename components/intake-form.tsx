'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { useEffect } from 'react';

const schema = z.object({
  builderId: z.string().min(1, 'Builder is required'),
  communityId: z.string().min(1, 'Community is required'),
  lot: z.string().min(1, 'Lot number is required'),
  address: z.string().min(1, 'Address is required'),
  modelPlanId: z.string().optional(),
  serviceIds: z.array(z.string()).min(1, 'Select at least one service'),
  dueDate: z.string().min(1, 'Due date is required'),
  walkTime: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.any().optional(),
  requestedBy: z.string().min(1, 'Requested by is required'),
  contact: z.string().min(1, 'Contact information is required'),
  poNumber: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const fetcher = async (url: string) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`API request failed: ${url} - Status: ${res.status}`);
      if (res.status === 404 || res.status >= 500) {
        return [];
      }
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Fetcher error for', url, error);
    return [];
  }
};

export function IntakeForm() {
  const { t } = useTranslation();
  const { data: builders } = useSWR('/api/builders', fetcher);
  const { data: communities } = useSWR('/api/communities', fetcher);
  const { data: modelPlans } = useSWR('/api/model-plans', fetcher);
  const { data: services } = useSWR('/api/services', fetcher);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      serviceIds: [],
    }
  });

  const builderId = useWatch({ control, name: 'builderId' });
  const modelPlanId = useWatch({ control, name: 'modelPlanId' });

  useEffect(() => {
    if (builderId && modelPlanId) {
      const modelPlan = modelPlans?.find((plan: any) => plan.id === modelPlanId);
      if (modelPlan?.defaults) {
        Object.entries(modelPlan.defaults).forEach(([key, value]) => {
          // @ts-ignore
          setValue(key, value);
        });
      }
    }
  }, [builderId, modelPlanId, modelPlans, setValue]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        console.log('Job request created successfully');
        alert('Job request created successfully!');
      } else {
        throw new Error('Failed to create job request');
      }
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
            <label htmlFor="builderId" className="block text-sm font-medium text-gray-700 mb-2">
              {t('builder')} <span className="text-red-500">*</span>
            </label>
            <select 
              id="builderId" 
              {...register('builderId')}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">-- Select Builder --</option>
              {builders?.map((builder: any) => (
                <option key={builder.id} value={builder.id}>
                  {builder.name}
                </option>
              ))}
            </select>
            {errors.builderId && (
              <p className="mt-1 text-sm text-red-600">{errors.builderId.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="communityId" className="block text-sm font-medium text-gray-700 mb-2">
              {t('community')} <span className="text-red-500">*</span>
            </label>
            <select 
              id="communityId" 
              {...register('communityId')}
              disabled={!builderId}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">-- Select Community --</option>
              {communities
                ?.filter((community: any) => community.builderId === builderId)
                .map((community: any) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
            </select>
            {errors.communityId && (
              <p className="mt-1 text-sm text-red-600">{errors.communityId.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="modelPlanId" className="block text-sm font-medium text-gray-700 mb-2">
              {t('modelPlan')}
            </label>
            <select 
              id="modelPlanId" 
              {...register('modelPlanId')}
              disabled={!builderId}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">-- Select Model Plan (Optional) --</option>
              {modelPlans
                ?.filter((plan: any) => plan.builderId === builderId)
                .map((plan: any) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
            </select>
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
              {t('address')} <span className="text-red-500">*</span>
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
          🛠️ Services Required
        </h3>
        
        <div className="space-y-3">
          {services?.map((service: any) => (
            <label 
              key={service.id}
              className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                value={service.id}
                {...register('serviceIds')}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="ml-3 text-sm font-medium text-gray-900">{service.name}</span>
            </label>
          ))}
        </div>
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
            <input 
              id="requestedBy" 
              {...register('requestedBy')}
              placeholder="Name of person requesting"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            {t('notes')}
          </label>
          <textarea 
            id="notes" 
            {...register('notes')}
            rows={4}
            placeholder="Any additional information or special instructions..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
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
