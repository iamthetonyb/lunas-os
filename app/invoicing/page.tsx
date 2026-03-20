'use client';

import { PageHeader } from '@/components/page-header';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QueryWrapper } from '@/components/QueryWrapper';

export default function InvoicingPage() {
  const { t } = useTranslation();
  const [builderId, setBuilderId] = useState<string | null>(null);
  const builders = useQuery(api.queries.getBuilders, {});
  const blueBookEntries = useQuery(
    api.blueBook.list,
    builderId
      ? { builderId: builderId as Id<"builders">, status: 'COMPLETE', invoiced: false }
      : 'skip'
  );
  const buildInvoice = useMutation(api.invoicing.build);
  const invoiceList = useQuery(
    api.invoicing.list,
    builderId ? { builderId: builderId as Id<"builders"> } : {}
  );

  const entries = blueBookEntries?.entries;

  const handleBuildDraft = async () => {
    const entryIds = Array.isArray(entries) ? entries.map((e: any) => e.id as Id<"blueBookEntries">) : [];
    if (!builderId || entryIds.length === 0) return;
    try {
      await buildInvoice({
        builderId: builderId as Id<"builders">,
        entryIds,
      });
      toast.success('Invoice draft created successfully!');
    } catch (error) {
      console.error('Failed to build invoice draft', error);
      toast.error('Failed to build invoice draft');
    }
  };

  return (
    <>
      <PageHeader
        title={t('invoicing.title')}
        description={t('invoicing.description')}
        action={
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + {t('invoicing.createInvoice')}
          </button>
        }
      />
      <main className="px-6 py-6">
        {/* Build Invoice Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            {t('invoicing.buildNewInvoice')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('invoicing.selectBuilder')}</label>
              <select
                onChange={(e) => setBuilderId(e.target.value || null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">-- {t('invoicing.selectBuilder')} --</option>
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
                  ? `${t('invoicing.buildDraft')} (${entries.length})`
                  : t('invoicing.buildDraftInvoice')}
              </button>
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{t('invoicing.recentInvoices')}</h3>
          </div>
          <QueryWrapper
            data={invoiceList}
            loadingMessage="Loading invoices..."
            emptyMessage="No invoices found. Build a draft to get started."
            errorMessage="Failed to load invoices."
          >
            {(invoices) => (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('invoicing.invoiceNumber')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('common.builder')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('common.date')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('common.amount')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('common.status')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoices.map((invoice: any) => {
                      const statusLabel = invoice.status === 'PAID' ? 'Paid'
                        : invoice.status === 'SENT' ? 'Sent'
                        : invoice.status === 'VOID' ? 'Void'
                        : 'Draft';
                      return (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                            <Link href={`/invoicing/${invoice.id}`} className="hover:underline">
                              {invoice.id}
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {invoice.builderName ?? '--'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {invoice.issuedOn ?? '--'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {invoice.total != null ? `$${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '--'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              statusLabel === 'Paid'
                                ? 'bg-green-100 text-green-800'
                                : statusLabel === 'Sent'
                                ? 'bg-blue-100 text-blue-800'
                                : statusLabel === 'Void'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex gap-3">
                              <Link href={`/invoicing/${invoice.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                                {t('invoicing.view')}
                              </Link>
                              <button className="text-gray-600 hover:text-gray-800 font-medium">
                                {t('invoicing.pdf')}
                              </button>
                              {statusLabel === 'Draft' && (
                                <button className="text-green-600 hover:text-green-800 font-medium">
                                  {t('invoicing.send')}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </QueryWrapper>
        </div>
      </main>
    </>
  );
}
