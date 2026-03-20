'use client';

import { PageHeader } from '@/components/page-header';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import SignatureCanvas from 'react-signature-canvas';
import { useRef, useState, use } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';

const schema = z.object({
  status: z.enum(['COMPLETE', 'NOT_DONE']),
  notes: z.string().optional(),
  windows: z.number().optional(),
  tubs: z.number().optional(),
});

type FormData = z.infer<typeof schema>;

export default function FieldTicketPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  // Unwrap params using React.use() for Next.js 15
  const { assignmentId } = use(params);

  const assignment = useQuery(
    api.assignmentFunctions.getById,
    { id: assignmentId as Id<"assignments"> }
  );
  const submitTicket = useMutation(api.assignmentFunctions.submitTicket);

  const error = assignment === null; // null means not found; undefined means loading
  const foremanSigRef = useRef<SignatureCanvas>(null);
  const customerSigRef = useRef<SignatureCanvas>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (data) => {
    const foremanSig = foremanSigRef.current?.toDataURL();
    const customerSig = customerSigRef.current?.toDataURL();

    try {
      await submitTicket({
        assignmentId: assignmentId as Id<"assignments">,
        windows: data.windows?.toString(),
        tubs: data.tubs?.toString(),
        notes: data.notes,
        foremanSig,
        customerSig,
      });
      alert('Field ticket submitted successfully!');
    } catch (error) {
      console.error('Failed to submit field ticket', error);
      alert('Error submitting field ticket');
    }
  });

  if (error) return (
    <>
      <PageHeader title="Field Ticket" description={`Assignment ${assignmentId}`} />
      <main className="px-6 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Failed to load assignment</p>
        </div>
      </main>
    </>
  );

  if (!assignment) return (
    <>
      <PageHeader title="Field Ticket" description={`Assignment ${assignmentId}`} />
      <main className="px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-600">Loading assignment...</p>
        </div>
      </main>
    </>
  );

  return (
    <>
      <PageHeader
        title="Field Ticket"
        description={`Assignment ID: ${assignment.id}`}
        action={
          <Link href="/schedule" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
            ← Back to Schedule
          </Link>
        }
      />
      <main className="px-6 py-6">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ticket Status</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  {...register('status')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="COMPLETE">Complete</option>
                  <option value="NOT_DONE">Not Complete</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Windows</label>
                  <input
                    type="number"
                    {...register('windows', { valueAsNumber: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Count"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tubs</label>
                  <input
                    type="number"
                    {...register('tubs', { valueAsNumber: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Count"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  id="notes"
                  {...register('notes')}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any notes..."
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Signatures</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Foreman Signature</label>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <SignatureCanvas
                    ref={foremanSigRef}
                    canvasProps={{
                      width: 500,
                      height: 200,
                      className: 'w-full bg-white'
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => foremanSigRef.current?.clear()}
                  className="mt-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear Signature
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer Signature</label>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <SignatureCanvas
                    ref={customerSigRef}
                    canvasProps={{
                      width: 500,
                      height: 200,
                      className: 'w-full bg-white'
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => customerSigRef.current?.clear()}
                  className="mt-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear Signature
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link
              href="/schedule"
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Submit Ticket
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
