import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    args: {
        builderId: v.optional(v.id("builders")),
    },
    handler: async (ctx, args) => {
        let invoices;
        if (args.builderId) {
            invoices = await ctx.db
                .query("invoices")
                .withIndex("by_builder", (q) => q.eq("builderId", args.builderId))
                .order("desc")
                .collect();
        } else {
            invoices = await ctx.db
                .query("invoices")
                .order("desc")
                .collect();
        }

        // Enrich with builder names
        const enriched = await Promise.all(
            invoices.map(async (invoice) => {
                let builderName: string | null = null;
                if (invoice.builderId) {
                    const builder = await ctx.db.get(invoice.builderId);
                    builderName = builder?.name ?? null;
                }
                return {
                    ...invoice,
                    id: invoice._id,
                    builderName,
                };
            })
        );

        return enriched;
    },
});

export const getById = query({
    args: { id: v.id("invoices") },
    handler: async (ctx, args) => {
        const invoice = await ctx.db.get(args.id);
        if (!invoice) return null;

        let builderName = null;
        if (invoice.builderId) {
            const b = await ctx.db.get(invoice.builderId);
            builderName = b?.name ?? null;
        }

        const lines = await ctx.db
            .query("invoiceLines")
            .withIndex("by_invoice", (q) => q.eq("invoiceId", args.id))
            .collect();

        return {
            ...invoice,
            id: invoice._id,
            builderName,
            lines: lines.map((l) => ({ ...l, id: l._id })),
        };
    },
});

export const build = mutation({
    args: {
        builderId: v.id("builders"),
        entryIds: v.array(v.id("blueBookEntries")),
    },
    handler: async (ctx, args) => {
        const taxRate = 0; // Tax configured externally if needed

        // Fetch entries
        const entries = await Promise.all(
            args.entryIds.map((id) => ctx.db.get(id))
        );
        const validEntries = entries.filter(Boolean);

        // Calculate totals
        let subtotal = 0;
        const lineData: Array<{
            blueBookId: any;
            description: string;
            qty: number;
            unit: string;
            unitPrice: number;
            amount: number;
        }> = [];

        for (const entry of validEntries) {
            if (!entry) continue;
            const amount = parseFloat(entry.amount ?? '0');
            subtotal += amount;

            let serviceName = entry.accountCategoryName ?? 'Service';
            if (entry.serviceId) {
                const svc = await ctx.db.get(entry.serviceId);
                if (svc) serviceName = svc.name;
            }

            let communityName = '';
            if (entry.communityId) {
                const comm = await ctx.db.get(entry.communityId);
                communityName = comm?.name ?? '';
            }

            lineData.push({
                blueBookId: entry._id,
                description: `${serviceName} - ${communityName} Lot ${entry.lot ?? ''}`.trim(),
                qty: 1,
                unit: 'EA',
                unitPrice: amount,
                amount,
            });
        }

        const tax = subtotal * taxRate;
        const total = subtotal + tax;

        // Create invoice
        const invoiceId = await ctx.db.insert("invoices", {
            builderId: args.builderId,
            status: "DRAFT",
            issuedOn: new Date().toISOString().split('T')[0],
            subtotal,
            tax,
            total,
            createdAt: Date.now(),
        });

        // Create lines and update entries
        for (const line of lineData) {
            const lineId = await ctx.db.insert("invoiceLines", {
                invoiceId,
                blueBookId: line.blueBookId,
                description: line.description,
                qty: line.qty,
                unit: line.unit,
                unitPrice: line.unitPrice,
                amount: line.amount,
            });

            // Mark entry as invoiced
            await ctx.db.patch(line.blueBookId, {
                invoiceLineId: lineId,
                updatedAt: Date.now(),
            });
        }

        return { success: true, invoiceId };
    },
});
