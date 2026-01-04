'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { fetchJSON } from '@/lib/utils/fetch-json';
import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { EditIntakeModal } from '@/components/edit-intake-modal';
import { useSession } from 'next-auth/react';
import { useOrgRealtime } from '@/lib/realtime/use-org-realtime';
import { toast } from 'sonner';

// Helper: Parse ISO date string as local date (avoids UTC midnight -> previous day issue)
const formatDateLocal = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  // Append noon time to prevent timezone rollback
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString();
};

export type RecentIntake = {
  id: string;
  builderId: string | null;
  builderName: string;
  communityId: string | null;
  communityName: string;
  modelPlanId: string | null;
  lot: string;
  address: string | null;
  modelPlanName: string | null;
  dueDate: string;
  createdAt: string;
  notes: string | null;
  poNumber: string | null;
  contact: string | null; // deprecated - kept for backward compat
  contactPhone: string | null;
  contactEmail: string | null;
  requestedBy: string | null;
  services: {
    id: string;
    name: string;
    walkTime: string | null;
  }[];
  amount: string | null;
  status: string | null;
};

type RecentIntakesResponse = {
  intakes: RecentIntake[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const fetcher = (url: string) => fetchJSON<RecentIntakesResponse>(url);

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-base text-gray-900">{value}</p>
    </div>
  );
}

function IntakeDetailModal({
  intake,
  open,
  onClose,
  onEdit,
  onDelete,
}: {
  intake: RecentIntake | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!intake) return null;

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                  Intake Details
                </Dialog.Title>
                <div className="mt-4 space-y-6">
                  <div>
                    <h4 className="text-base font-semibold text-gray-800 border-b pb-2">
                      Location & Plan
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                      <DetailItem label="Community" value={intake.communityName} />
                      <DetailItem label="Builder" value={intake.builderName} />
                      <DetailItem label="Lot" value={intake.lot} />
                      <DetailItem label="Address" value={intake.address} />
                      <DetailItem label="Model/Plan" value={intake.modelPlanName} />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-800 border-b pb-2">
                      Scheduling & Contact
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                      <DetailItem
                        label="Due Date"
                        value={formatDateLocal(intake.dueDate)}
                      />
                      <DetailItem label="PO Number" value={intake.poNumber} />
                      <DetailItem label="Requested By" value={intake.requestedBy} />
                      <DetailItem label="Contact Phone" value={intake.contactPhone} />
                      <DetailItem label="Contact Email" value={intake.contactEmail} />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-gray-800 border-b pb-2">
                      Services
                    </h4>
                    <ul className="space-y-2 mt-2">
                      {intake.services.map((service, index) => (
                        <li
                          key={index}
                          className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2"
                        >
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
                      <h4 className="text-base font-semibold text-gray-800 border-b pb-2">
                        Notes
                      </h4>
                      <p className="text-base text-gray-700 whitespace-pre-wrap mt-2">
                        {intake.notes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-between gap-2">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-red-100 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-200 disabled:opacity-50"
                    onClick={onDelete}
                    disabled={!intake.id}
                  >
                    Delete
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                      onClick={onClose}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200"
                      onClick={onEdit}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

function RecentIntakes({ onIntakeSelect, onDelete, onEdit }: { onIntakeSelect: (intake: RecentIntake) => void, onDelete: (intakeId: string) => void, onEdit: (intake: RecentIntake) => void }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useSWR(`/api/job-requests/recent?page=${page}&limit=10`, fetcher);

  if (isLoading) {
    return <p className="text-gray-500">Loading recent intakes...</p>;
  }

  if (error) {
    return <p className="text-red-500">Failed to load recent intakes.</p>;
  }

  const { intakes, total, totalPages } = data || { intakes: [], total: 0, totalPages: 0 };

  if (!intakes || intakes.length === 0) {
    return <p className="text-gray-500">No recent intakes found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-500">Community</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-500">Builder</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-500">Lot</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-500">Due Date</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-500">Services</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {intakes.map((intake) => (
              <tr
                key={intake.id}
                onClick={() => onIntakeSelect(intake)}
                className="cursor-pointer hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-medium text-gray-900">{intake.communityName}</td>
                <td className="px-4 py-3 text-gray-700">{intake.builderName}</td>
                <td className="px-4 py-3 text-gray-700">{intake.lot}</td>
                <td className="px-4 py-3 text-gray-700">
                  {formatDateLocal(intake.dueDate)}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {intake.services.map((s) => s.name).join(', ')}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(intake);
                      }}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(intake.id);
                      }}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-lg">
        <div className="text-sm text-gray-500">
          Showing <span className="font-medium">{intakes.length}</span> of <span className="font-medium">{total}</span> intakes
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium disabled:opacity-50 hover:bg-white"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium disabled:opacity-50 hover:bg-white"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IntakePage() {
  const { data: session } = useSession();
  const orgId = (session?.user as any)?.orgId;
  useOrgRealtime(orgId);

  const [selectedIntake, setSelectedIntake] = useState<RecentIntake | null>(null);
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  function handleIntakeSelect(intake: RecentIntake) {
    setSelectedIntake(intake);
    setDetailModalOpen(true);
  }

  function handleCloseDetailModal() {
    setDetailModalOpen(false);
  }

  function handleEdit() {
    setDetailModalOpen(false);
    setEditModalOpen(true);
  }

  function handleEditFromTable(intake: RecentIntake) {
    setSelectedIntake(intake);
    setEditModalOpen(true);
  }

  function handleCloseEditModal() {
    setEditModalOpen(false);
  }

  async function handleEditSuccess() {
    setEditModalOpen(false);
    await mutate('/api/job-requests/recent');
  }

  async function handleDelete(intakeId: string) {
    if (!intakeId) {
      alert('Cannot delete intake: ID is missing.');
      return;
    }
    console.log('[intake] Attempting to delete:', intakeId);
    if (!window.confirm('Are you sure you want to delete this intake?')) {
      return;
    }

    try {
      await fetchJSON(`/api/job-requests/${intakeId}`, { method: 'DELETE' });
      console.log('[intake] Successfully deleted:', intakeId);
      await mutate('/api/job-requests/recent');
      setDetailModalOpen(false); // Close modal if open
      toast.success('Intake deleted successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[intake] Failed to delete:', intakeId, message);
      toast.error(`Failed to delete intake: ${message}`);
    }
  }

  return (
    <>
      <PageHeader
        title="Intake"
        description="Manage job intake and new project submissions"
        action={
          <Link
            href="/intake/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + New Intake
          </Link>
        }
      />
      <main className="px-6 py-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Intakes</h3>
          <RecentIntakes onIntakeSelect={handleIntakeSelect} onDelete={handleDelete} onEdit={handleEditFromTable} />
        </div>
      </main>
      <IntakeDetailModal
        intake={selectedIntake}
        open={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        onEdit={handleEdit}
        onDelete={() => selectedIntake && handleDelete(selectedIntake.id)}
      />
      <EditIntakeModal
        intake={selectedIntake}
        open={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSuccess={handleEditSuccess}
      />
    </>
  );
}
