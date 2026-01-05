import { getDb } from '@/lib/db/get-db';
import { blueBookEntries, jobRequests, jobRequestServices, builders, communities, modelPlans, services, assignments } from '@/db/schema';
import { and, gte, lte, isNotNull, eq, sql } from 'drizzle-orm';
import { safe, ok } from '@/lib/api/http';
import { requireMembership } from '@/lib/auth/guards';

export const runtime = 'nodejs';

function parseDateParam(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

function formatDateInput(date: Date) {
  return date.toISOString().split('T')[0];
}

export const GET = safe(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const now = new Date();
  const startDate = parseDateParam(searchParams.get('start'), now);
  const defaultEnd = new Date(startDate);
  defaultEnd.setDate(defaultEnd.getDate() + 14);
  const endDate = parseDateParam(searchParams.get('end'), defaultEnd);

  const startIso = formatDateInput(startDate);
  const endIso = formatDateInput(endDate);

  await requireMembership(['admin', 'backoffice', 'contractor']);
  const db = await getDb();

  const blueBookData = await db.query.blueBookEntries.findMany({
    where: and(
      isNotNull(blueBookEntries.startDate),
      gte(blueBookEntries.startDate, startIso),
      lte(blueBookEntries.startDate, endIso)
    ),
    columns: {
      id: true,
      startDate: true,
      originalStartDate: true,
      lot: true,
      accountCategoryCode: true,
      accountCategoryName: true,
      poNumber: true,
      amount: true,
      status: true,
      assignedForemanName: true,
      communityId: true,
      source: true,
    },
    with: {
      builder: {
        columns: { name: true },
      },
      community: {
        columns: { name: true },
      },
      service: {
        columns: { name: true },
      },
    },
    orderBy: (entries, { asc }) => asc(entries.startDate),
  });

  const jobRequestData = await db
    .select({
      id: jobRequests.id,
      dueDate: jobRequests.dueDate,
      originalDueDate: jobRequests.originalDueDate,
      lot: jobRequests.lot,
      poNumber: jobRequests.poNumber,
      requestedBy: jobRequests.requestedBy,
      builderName: builders.name,
      communityName: communities.name,
      modelPlanName: modelPlans.name,
      jobRequestServiceId: jobRequestServices.id,
      serviceId: jobRequestServices.serviceId,
      serviceName: services.name,
      walkTime: jobRequestServices.walkTime,
      assignedForemanName: jobRequestServices.assignedForemanName,
      assignmentStatus: assignments.status,
    })
    .from(jobRequests)
    .leftJoin(builders, eq(jobRequests.builderId, builders.id))
    .leftJoin(communities, eq(jobRequests.communityId, communities.id))
    .leftJoin(modelPlans, eq(jobRequests.modelPlanId, modelPlans.id))
    .leftJoin(jobRequestServices, eq(jobRequests.id, jobRequestServices.jobRequestId))
    .leftJoin(services, eq(jobRequestServices.serviceId, services.id))
    .leftJoin(assignments, eq(jobRequestServices.id, assignments.jobRequestServiceId))
    .where(
      and(
        isNotNull(jobRequests.dueDate),
        gte(jobRequests.dueDate, startIso),
        lte(jobRequests.dueDate, endIso)
      )
    );

  const formattedBlueBook = blueBookData.map((entry) => {
    const builderName = entry.builder?.name ?? null;
    const communityName = entry.community?.name ?? null;
    const serviceName = entry.service?.name ?? entry.accountCategoryName ?? null;
    const accountCategoryName = entry.accountCategoryName ?? entry.service?.name ?? null;
    const communityCode = communityName ?? entry.communityId;
    const jobNumber =
      communityCode && entry.lot
        ? `${communityCode}-${entry.lot}`
        : entry.lot || communityCode || null;

    return {
      id: entry.id,
      startDate: entry.startDate,
      originalStartDate: entry.originalStartDate,
      builderName,
      communityName,
      lot: entry.lot,
      contractorName: accountCategoryName,
      serviceName,
      jobNumber,
      accountCategoryCode: entry.accountCategoryCode,
      invoiceNumber: entry.poNumber,
      amount: entry.amount,
      status: entry.status,
      assignedForemanName: entry.assignedForemanName,
      isScraped: entry.source === 'scraped',
    };
  });

  const jobRequestMap = new Map<string, {
    id: string;
    dueDate: string | null;
    originalDueDate: string | null;
    lot: string | null;
    poNumber: string | null;
    requestedBy: string | null;
    builderName: string | null;
    communityName: string | null;
    modelPlanName: string | null;
    services: Array<{ id: string | null; jobRequestServiceId: string | null; name: string | null; walkTime: string | null; assignedForemanName: string | null; assignmentStatus: string | null }>;
  }>();

  jobRequestData.forEach((row) => {
    if (!jobRequestMap.has(row.id)) {
      jobRequestMap.set(row.id, {
        id: row.id,
        dueDate: row.dueDate,
        originalDueDate: row.originalDueDate,
        lot: row.lot,
        poNumber: row.poNumber,
        requestedBy: row.requestedBy,
        builderName: row.builderName,
        communityName: row.communityName,
        modelPlanName: row.modelPlanName,
        services: [],
      });
    }
    const entry = jobRequestMap.get(row.id)!;
    if (row.serviceId && row.serviceName && row.jobRequestServiceId) {
      // Deduplicate services: Check if we already have this service recorded
      const existingServiceIndex = entry.services.findIndex(s => s.jobRequestServiceId === row.jobRequestServiceId);

      if (existingServiceIndex === -1) {
        // New service, add it
        entry.services.push({
          id: row.serviceId,
          jobRequestServiceId: row.jobRequestServiceId,
          name: row.serviceName,
          walkTime: row.walkTime,
          assignedForemanName: row.assignedForemanName,
          assignmentStatus: row.assignmentStatus,
        });
      } else {
        // Service exists (likely due to multiple assignments). 
        // Logic: specific status overrides null/pending? 
        // For now, if current row has an assignment status and existing doesn't, allow overwrite?
        // Actually, easiest is just to take the first one or ignore duplicates if they are effectively the same essential data for the schedule card.
        // We'll prioritize rows that HAVE an assignment status.
        if (row.assignmentStatus && !entry.services[existingServiceIndex].assignmentStatus) {
          entry.services[existingServiceIndex].assignmentStatus = row.assignmentStatus;
        }
      }
    }
  });

  // Create one schedule entry per service (each service is a separate job on the schedule)
  const formattedJobRequests = Array.from(jobRequestMap.values()).flatMap((req) => {
    const communityCode = req.communityName ?? null;
    const jobNumber =
      communityCode && req.lot
        ? `${communityCode}-${req.lot}`
        : req.lot || communityCode || null;

    if (req.services.length === 0) {
      // If no services, still show the job request
      return [{
        id: req.id,
        startDate: req.dueDate,
        originalStartDate: req.originalDueDate,
        builderName: req.builderName,
        communityName: req.communityName,
        lot: req.lot,
        contractorName: 'No Service',
        serviceName: 'No Service',
        serviceDisplay: 'No Service',
        jobNumber: jobNumber,
        accountCategoryCode: null,
        invoiceNumber: req.poNumber,
        amount: null,
        status: 'Pending',
        walkTime: null,
        requestedBy: req.requestedBy,
        assignedForemanName: null,
        isExtraWork: false,
        isScraped: false,
      }];
    }

    // Create one schedule item per service so each service appears as a separate job
    return req.services.map((service) => ({
      id: service.jobRequestServiceId || `${req.id}-${service.id}`, // Use actual job_request_service ID
      startDate: req.dueDate,
      originalStartDate: req.originalDueDate,
      builderName: req.builderName,
      communityName: req.communityName,
      lot: req.lot,
      contractorName: service.name,
      serviceName: service.name,
      jobNumber: jobNumber,
      accountCategoryCode: null,
      serviceDisplay: service.name || 'Cleanup',
      status: service.assignmentStatus || 'Pending',
      invoiceNumber: req.poNumber,
      amount: null,
      walkTime: service.walkTime,
      requestedBy: req.requestedBy,
      assignedForemanName: service.assignedForemanName,
      isExtraWork: false,
      isScraped: false,
    }));
  });

  const combinedResults = [...formattedBlueBook, ...formattedJobRequests];

  return ok(Array.isArray(combinedResults) ? combinedResults : []);
});
