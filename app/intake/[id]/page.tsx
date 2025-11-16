'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { fetchJSON } from '@/lib/utils/fetch-json';

type IntakeDetail = {
  id: string;
  builderName: string;
  communityName: string;
  lot: string;
  address: string | null;
  modelPlanName: string | null;
  dueDate: string;
  createdAt: string;
  notes: string | null;
  poNumber: string | null;
  contact: string | null;
  requestedBy: string | null;
  services: {
    name: string | null;
    walkTime: string | null;
  }[];
};

const fetcher = (url: string) => fetchJSON<IntakeDetail>(url);

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
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { data: intake, isLoading, error } = useSWR(
    id ? `/api/job-requests/${id}` : null,
    fetcher
  );

  const pageTitle = intake ? `Intake: ${intake.communityName} Lot ${intake.lot}` : 'Intake Details';

  return (
    <>
      <PageHeader
        title={pageTitle}
        description="Details for this job intake request."
        action={
          <div className="flex gap-2">
            <Link
              href="/intake"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ← Back to Intakes
            </Link>
            <Link
              href={`/intake/${id}/edit`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Edit
            </Link>
          </div>
        }
      />
      <main className="px-6 py-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {isLoading && <p className="text-gray-500">Loading details...</p>}
          {error && <p className="text-red-500">Failed to load intake details.</p>}
          {intake && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
                  Location & Plan
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <DetailItem label="Community" value={intake.communityName} />
                  <DetailItem label="Builder" value={intake.builderName} />
                  <DetailItem label="Lot" value={intake.lot} />
                  <DetailItem label="Address" value={intake.address} />
                  <DetailItem label="Model/Plan" value={intake.modelPlanName} />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
                  Scheduling & Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <DetailItem
                    label="Due Date"
                    value={new Date(intake.dueDate).toLocaleDateString()}
                  />
                  <DetailItem label="PO Number" value={intake.poNumber} />
                  <DetailItem label="Requested By" value={intake.requestedBy} />
                  <DetailItem label="Contact" value={intake.contact} />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
                  Services
                </h3>
                <ul className="space-y-2">
                  {intake.services.map((service, index) => (
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
                    Notes
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
