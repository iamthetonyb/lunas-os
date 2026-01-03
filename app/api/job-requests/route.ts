import { desc, eq, and, inArray } from 'drizzle-orm';
import { safe, ok } from '@/lib/api/http';
import { requireMembership } from '@/lib/auth/guards';
import { getDb } from '@/lib/db/get-db';
import {
    jobRequests,
    jobRequestServices,
    builders,
    communities,
    modelPlans,
    services,
} from '@/db/schema';

export const runtime = 'nodejs';

export const GET = safe(async (req, context) => {
    const membership = await requireMembership(['admin', 'backoffice', 'contractor']);
    const db = await getDb();

    const { searchParams } = new URL(req.url);
    const isExtraWork = searchParams.get('isExtraWork') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    const whereConditions = [];

    if (isExtraWork) {
        whereConditions.push(eq(jobRequests.isExtraWork, true));
    }

    // If no filters and generic query, maybe limit?
    // For extra work page, we want pagination or all. I'll default to all (or large limit) if no limit specified?
    // Or just return all for now as dataset is small.

    const baseRows = await db
        .select({
            id: jobRequests.id,
            receivedVia: jobRequests.receivedVia,
            requestedBy: jobRequests.requestedBy,
            contactPhone: jobRequests.contactPhone,
            contactEmail: jobRequests.contactEmail,
            builderId: jobRequests.builderId,
            communityId: jobRequests.communityId,
            lot: jobRequests.lot,
            address: jobRequests.address,
            modelPlanId: jobRequests.modelPlanId,
            dueDate: jobRequests.dueDate,
            notes: jobRequests.notes,
            poNumber: jobRequests.poNumber,
            isExtraWork: jobRequests.isExtraWork,
            createdById: jobRequests.createdById,
            createdAt: jobRequests.createdAt,
            builderName: builders.name,
            communityName: communities.name,
            modelPlanName: modelPlans.name,
        })
        .from(jobRequests)
        .leftJoin(builders, eq(jobRequests.builderId, builders.id))
        .leftJoin(communities, eq(jobRequests.communityId, communities.id))
        .leftJoin(modelPlans, eq(jobRequests.modelPlanId, modelPlans.id))
        .where(and(...whereConditions))
        .orderBy(desc(jobRequests.createdAt))
        .limit(limit ?? 100);

    const requestIds = baseRows.map((row) => row.id);
    const servicesByRequest = new Map<
        string,
        { id: string; name: string; walkTime: string | null }[]
    >();

    if (requestIds.length > 0) {
        const serviceRows = await db
            .select({
                jobRequestId: jobRequestServices.jobRequestId,
                serviceId: jobRequestServices.serviceId,
                serviceName: services.name,
                walkTime: jobRequestServices.walkTime,
            })
            .from(jobRequestServices)
            .leftJoin(services, eq(jobRequestServices.serviceId, services.id))
            .where(inArray(jobRequestServices.jobRequestId, requestIds));

        serviceRows.forEach((row) => {
            if (!row.jobRequestId || !row.serviceName || !row.serviceId) return;
            const list = servicesByRequest.get(row.jobRequestId) ?? [];
            list.push({ id: row.serviceId, name: row.serviceName, walkTime: row.walkTime });
            servicesByRequest.set(row.jobRequestId, list);
        });
    }

    const formatted = baseRows.map((row) => ({
        ...row,
        builderName: row.builderName ?? '—',
        communityName: row.communityName ?? '—',
        lot: row.lot ?? '—',
        modelPlanName: row.modelPlanName ?? '—',
        services: servicesByRequest.get(row.id) ?? [],
    }));

    return ok(formatted);
});
