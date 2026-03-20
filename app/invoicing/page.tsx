'use client';

import { PageHeader } from '@/components/page-header';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useState } from 'react';
import Link from 'next/link';

export default function InvoicingPage() {
  const [builderId, setBuilderId] = useState<string | null>(null);
  const builders = useQuery(api.queries.getBuilders, {});
  const blueBookEntries = useQuery(
    api.blueBook.list,
    builderId
      ? { builderId: builderId as Id<"builders">, status: 'COMPLETE', invoiced: false }
      : 'skip'
  );
  const buildInvoice = useMutation(api.invoicing.build);

  // Mock invoices data
  const invoices = [
    { id: 'INV-001', builder: 'Pulte', date: '2025-10-14', amount: '$12,450', status: 'Draft' },
    { id: 'INV-002', builder: 'Pulte', date: '2025-10-10', amount: '$8,900', status: 'Sent' },
    { id: 'INV-003', builder: 'Pulte', date: '2025-10-05', amount: '$15,200', status: 'Paid' },
  ];

  const entries = blueBookEntries?.entries;

  const handleBuildDraft = async () => {
    const entryIds = Array.isArray(entries) ? entries.map((e: any) => e.id as Id<"blueBookEntries">) : [];
    if (!builderId || entryIds.length === 0) return;
    try {
      await buildInvoice({
        builderId: builderId as Id<"builders">,
        entryIds,
      });
      alert('Invoice draft created successfully!');
    } catch (error) {
      console.error('Failed to build invoice draft', error);
      alert('Failed to build invoice draft');
    }
  };

  return (
    <>
      <PageHeader
        title="Invoicing"
        description="Generate and manage invoices"
        action={
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + New Invoice
          </button>
        }
      />
      <main className="px-6 py-6">
        {/* Build Invoice Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            💰 Build New Invoice
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Builder</label>
              <select
                onChange={(e) => setBuilderId(e.target.value || null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">-- Select Builder --</option>
                {Array.isArray(builders) && builders.map((builder: any) => (
                  <option key={builder._id} value={builder._id}>
                    {builder.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleBuildDraft}
                disabled={!entries || entries.length === 0}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {entries && entries.length > 0
                  ? `Build Draft (${entries.length} entries)`
                  : 'Build Draft Invoice'}
              </button>
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Invoices</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Builder
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      <Link href={`/invoicing/${invoice.id}`} className="hover:underline">
                        {invoice.id}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.builder}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {invoice.amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        invoice.status === 'Paid'
                          ? 'bg-green-100 text-green-800'
                          : invoice.status === 'Sent'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-3">
                        <button className="text-blue-600 hover:text-blue-800 font-medium">
                          View
                        </button>
                        <button className="text-gray-600 hover:text-gray-800 font-medium">
                          PDF
                        </button>
                        {invoice.status === 'Draft' && (
                          <button className="text-green-600 hover:text-green-800 font-medium">
                            Send
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
