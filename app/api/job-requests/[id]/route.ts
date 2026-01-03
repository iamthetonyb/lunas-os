import { z } from 'zod';
import { getDb } from '@/lib/db/get-db';
import { jobRequests, jobRequestServices, assignments } from '@/db/schema';
import { ok, err, safe } from '@/lib/api/http';
import { requireMembership } from '@/lib/auth/guards';
import { eq, inArray } from 'drizzle-orm';

export const runtime = 'nodejs';

const intakeUpdatePayloadSchema = z.object({
  builderId: z.string().uuid(),
  communityId: z.string().uuid(),
  modelPlanId: z
    .union([z.string().uuid(), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value && value !== '' ? value : null)),
  lot: z.string().min(1),
  address: z.string().optional().nullable(),
  dueDate: z.coerce.date(),
  walkTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  requestedBy: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
  serviceIds: z.array(z.string().uuid()).min(1, 'Select at least one service'),
});

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const PUT = safe(async (req, { params: paramsPromise }: { params: Promise<{ id: string }> }) => {
  await requireMembership(['admin', 'backoffice', 'contractor']);
  const db = await getDb();

  const params = await paramsPromise;
  const paramsParsed = paramsSchema.safeParse(params);
  if (!paramsParsed.success) {
    return err('Invalid job request ID', 400);
  }
  const { id: jobRequestId } = paramsParsed.data;

  const raw = await req.json();
  const parsed = intakeUpdatePayloadSchema.safeParse(raw);

  if (!parsed.success) {
    return err('Invalid payload', 400, parsed.error.flatten());
  }

  const { serviceIds, walkTime, contactPhone, contactEmail, dueDate, requestedBy, notes, poNumber, ...rest } =
    parsed.data;

  const dueDateISO = dueDate.toISOString().split('T')[0];

  const result = await db.transaction(async (tx) => {
    const [request] = await tx
      .update(jobRequests)
      .set({
        builderId: rest.builderId,
        communityId: rest.communityId,
        modelPlanId: rest.modelPlanId ?? null,
        lot: rest.lot,
        address: rest.address ?? null,
        dueDate: dueDateISO,
        requestedBy: requestedBy ?? null,
        notes: notes ?? null,
        poNumber: poNumber ?? null,
        contactPhone: contactPhone ?? null,
        contactEmail: contactEmail ?? null,
      })
      .where(eq(jobRequests.id, jobRequestId))
      .returning();

    // Simple approach: delete and re-insert services
    await tx.delete(jobRequestServices).where(eq(jobRequestServices.jobRequestId, jobRequestId));

    if (serviceIds.length) {
      await tx.insert(jobRequestServices).values(
        serviceIds.map((serviceId) => ({
          jobRequestId: request.id,
          serviceId,
          walkTime: walkTime ?? null,
        }))
      );
    }

    return request;
  });

  return ok(result);

});



export const DELETE = safe(async (req, { params: paramsPromise }: { params: Promise<{ id: string }> }) => {

  await requireMembership(['admin', 'backoffice']);

  const db = await getDb();


  const params = await paramsPromise;
  const paramsParsed = paramsSchema.safeParse(params);

  if (!paramsParsed.success) {

    return err('Invalid job request ID', 400);

  }

  const { id: jobRequestId } = paramsParsed.data;



  await db.transaction(async (tx) => {

    // 1. Find all services for this job request
    const services = await tx
      .select({ id: jobRequestServices.id })
      .from(jobRequestServices)
      .where(eq(jobRequestServices.jobRequestId, jobRequestId));

    const serviceIds = services.map(s => s.id);

    // 2. Delete assignments linked to these services
    if (serviceIds.length > 0) {
      await tx.delete(assignments).where(inArray(assignments.jobRequestServiceId, serviceIds));
    }

    // 3. Delete services
    await tx.delete(jobRequestServices).where(eq(jobRequestServices.jobRequestId, jobRequestId));

    // 4. Delete job request
    await tx.delete(jobRequests).where(eq(jobRequests.id, jobRequestId));

  });



  return new Response(null, { status: 204 });

});

