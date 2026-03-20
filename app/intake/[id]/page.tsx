'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTranslation } from 'react-i18next';

// Helper: Parse ISO date string as local date (avoids UTC midnight -> previous day issue)
const formatDateLocal = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  // Append noon time to prevent timezone rollback
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString();
};

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-base text-gray-900">{value}</p>
    </div>
  );
}

export default function IntakeDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const intake = useQuery(
    api.jobRequests.getById,
    id ? { id: id as Id<"jobRequests"> } : 'skip'
  );

  const isLoading = intake === undefined;
  const error = false; // Convex throws on error; undefined means loading

  const pageTitle = intake ? `Intake: ${intake.communityName} Lot ${intake.lot}` : 'Intake Details';

  return (
    <>
      <PageHeader
        title={pageTitle}
        description={t('intake.title')}
        action={
          <div className="flex gap-2">
            <Link
              href="/intake"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('common.back')}
            </Link>
            <Link
              href={`/intake/${id}/edit`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              {t('common.edit')}
            </Link>
          </div>
        }
      />
      <main className="px-6 py-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {isLoading && <p className="text-gray-500">{t('common.loading')}</p>}
          {error && <p className="text-red-500">Failed to load intake details.</p>}
          {intake && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
                  {t('intake.builderLocation')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <DetailItem label={t('common.community')} value={intake.communityName} />
                  <DetailItem label={t('common.builder')} value={intake.builderName} />
                  <DetailItem label={t('common.lot')} value={intake.lot} />
                  <DetailItem label={t('common.address')} value={intake.address} />
                  <DetailItem label={t('intake.modelPlan')} value={intake.modelPlanName} />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
                  {t('intake.scheduleInfo')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <DetailItem
                    label={t('intake.dueDate')}
                    value={formatDateLocal(intake.dueDate)}
                  />
                  <DetailItem label={t('intake.poNumber')} value={intake.poNumber} />
                  <DetailItem label={t('intake.requestedBy')} value={intake.requestedBy} />
                  <DetailItem label={t('intake.contact')} value={[intake.contactPhone, intake.contactEmail].filter(Boolean).join(' / ') || null} />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
                  {t('intake.services')}
                </h3>
                <ul className="space-y-2">
                  {intake.services.map((service: any, index: number) => (
                    <li key={index} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2">
                      <span className="font-medium text-gray-800">{service.name}</span>
                      {service.walkTime && (
                        <span className="text-sm text-gray-500">
                          Walk-thru: {service.walkTime}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {intake.notes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 border-b pb-2">
                    {t('common.notes')}
                  </h3>
                  <p className="text-base text-gray-700 whitespace-pre-wrap">
                    {intake.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
