'use client';

import { PageHeader } from '@/components/page-header';
import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

type InvoiceLine = {
    id: string;
    description?: string;
    qty?: number;
    amount?: number;
};

export default function InvoiceDetailPage() {
    const params = useParams();
    const id = params?.id as string;

    const invoice = useQuery(
        api.invoicing.getById,
        id ? { id: id as Id<"invoices"> } : 'skip'
    );

    const isLoading = invoice === undefined;

    if (isLoading) {
        return (
            <>
                <PageHeader title="Invoice Details" description="Loading invoice..." />
                <main className="px-6 py-6">
                    <div className="animate-pulse bg-gray-100 dark:bg-slate-800 h-48 rounded-lg" />
                </main>
            </>
        );
    }

    if (!invoice) {
        return (
            <>
                <PageHeader title="Invoice Details" description="Error loading invoice" />
                <main className="px-6 py-6">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="text-red-600 dark:text-red-400">
                            Failed to load invoice
                        </p>
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <PageHeader
                title={`Invoice ${invoice?.poNumber || id}`}
                description="Invoice details and line items"
            />
            <main className="px-6 py-6">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Invoice Number</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                                {invoice?.poNumber || '\u2014'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                                {invoice?.status || 'Draft'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                                ${invoice?.total || '0.00'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                                {invoice?.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : '\u2014'}
                            </p>
                        </div>
                    </div>

                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                        Line Items
                    </h3>
                    {(invoice?.lines?.length ?? 0) > 0 ? (
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead>
                                <tr>
                                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Description
                                    </th>
                                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Qty
                                    </th>
                                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Amount
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {invoice?.lines?.map((line: InvoiceLine) => (
                                    <tr key={line.id}>
                                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                            {line.description || '\u2014'}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                            {line.qty || 1}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                            ${line.amount || '0.00'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400">No line items yet.</p>
                    )}
                </div>
            </main>
        </>
    );
}
