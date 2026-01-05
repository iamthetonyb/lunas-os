import { z } from 'zod';
import { getDb } from '@/lib/db/get-db';
import { jobRequests, jobRequestServices, assignments, fieldTickets, blueBookEntries } from '@/db/schema';
import { ok, err, safe } from '@/lib/api/http';
import { requireMembership } from '@/lib/auth/guards';
import { eq, inArray, and } from 'drizzle-orm';

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
  amount: z.union([z.number(), z.string(), z.null()]).optional(),
  status: z.string().optional().nullable(),
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

  const { serviceIds, walkTime, contactPhone, contactEmail, dueDate, requestedBy, notes, poNumber, amount, status, ...rest } =
    parsed.data;

  // Sanitize walkTime to HH:00 format (strip minutes)
  const sanitizedWalkTime = walkTime ? walkTime.split(':')[0] + ':00' : null;

  const dueDateISO = dueDate.toISOString().split('T')[0];

  const result = await db.transaction(async (tx) => {
    // 1. Update simple fields
    const [updatedRequest] = await tx
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
        amount: amount !== undefined ? (amount === '' || amount === null ? null : amount.toString()) : undefined,
        status: status ?? undefined,
      })
      .where(eq(jobRequests.id, jobRequestId))
      .returning();

    if (!updatedRequest) throw new Error('Job Request not found or failed to update');

    // 2. Fetch existing services
    const currentServices = await tx
      .select({
        id: jobRequestServices.id,
        serviceId: jobRequestServices.serviceId
      })
      .from(jobRequestServices)
      .where(eq(jobRequestServices.jobRequestId, jobRequestId));

    const currentServiceIds = currentServices.map((s) => s.serviceId);
    const incomingServiceIds = serviceIds;

    // A. Services to Add (in payload but not in DB)
    const servicesToAdd = incomingServiceIds.filter((id) => !currentServiceIds.includes(id));
    if (servicesToAdd.length > 0) {
      await tx.insert(jobRequestServices).values(
        servicesToAdd.map((serviceId) => ({
          jobRequestId: jobRequestId,
          serviceId,
          walkTime: sanitizedWalkTime,
        }))
      );
    }

    // Services to Remove (in DB but not in payload)
    // Safe Diffing: Only delete if not assigned
    const servicesToRemove = currentServices.filter((s) => !incomingServiceIds.includes(s.serviceId as string));
    for (const s of servicesToRemove) {
      try {
        // Check for assignments
        const [assignment] = await tx
          .select({ id: assignments.id })
          .from(assignments)
          .where(eq(assignments.jobRequestServiceId, s.id))
          .limit(1);

        if (!assignment) {
          await tx.delete(jobRequestServices).where(eq(jobRequestServices.id, s.id));
        }
        // If assigned, just skip - don't crash
      } catch (deleteError) {
        // Ignore FK constraint errors - let the service stay
        console.warn(`[PUT /job-requests] Could not remove service ${s.id}, likely FK constraint. Skipping.`);
      }
    }

    // C. Services to Keep (update walkTime with sanitized value)
    const servicesToKeep = incomingServiceIds.filter((id) => currentServiceIds.includes(id));
    if (servicesToKeep.length > 0) {
      await tx
        .update(jobRequestServices)
        .set({ walkTime: sanitizedWalkTime })
        .where(
          and(
            eq(jobRequestServices.jobRequestId, jobRequestId),
            inArray(jobRequestServices.serviceId, servicesToKeep)
          )
        );
    }

    // 3. Return fully updated object
    // Fetch again with joined services to return full state
    const [finalRequest] = await tx
      .select()
      .from(jobRequests)
      .where(eq(jobRequests.id, jobRequestId));

    const finalServices = await tx
      .select({
        id: jobRequestServices.id,
        serviceId: jobRequestServices.serviceId,
        walkTime: jobRequestServices.walkTime,
        assignedForemanName: jobRequestServices.assignedForemanName,
      })
      .from(jobRequestServices)
      .where(eq(jobRequestServices.jobRequestId, jobRequestId));

    return {
      ...finalRequest,
      services: finalServices
    };
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
    // CRITICAL FIX: Explicit delete order to handle FK constraints safely
    // 1. Delete Blue Book Entries linked to assignments of this job request
    const services = await tx
      .select({ id: jobRequestServices.id })
      .from(jobRequestServices)
      .where(eq(jobRequestServices.jobRequestId, jobRequestId));

    const serviceIds = services.map(s => s.id);

    if (serviceIds.length > 0) {
      const assignmentRows = await tx
        .select({ id: assignments.id })
        .from(assignments)
        .where(inArray(assignments.jobRequestServiceId, serviceIds));

      const assignmentIds = assignmentRows.map(a => a.id);

      if (assignmentIds.length > 0) {
        // Step 1: Delete Blue Book Entries
        await tx.delete(blueBookEntries).where(inArray(blueBookEntries.assignmentId, assignmentIds));

        // Also clean up Field Tickets (safety)
        await tx.delete(fieldTickets).where(inArray(fieldTickets.assignmentId, assignmentIds));

        // Step 2: Delete Assignments
        await tx.delete(assignments).where(inArray(assignments.jobRequestServiceId, serviceIds));
      }
    }

    // Step 3: Delete Job Request Services
    await tx.delete(jobRequestServices).where(eq(jobRequestServices.jobRequestId, jobRequestId));

    // Step 4: Delete Job Request
    await tx.delete(jobRequests).where(eq(jobRequests.id, jobRequestId));
  });

  return new Response(null, { status: 204 });
});

export const PATCH = safe(async (req, { params: paramsPromise }: { params: Promise<{ id: string }> }) => {
  await requireMembership(['admin', 'backoffice', 'contractor']);
  const db = await getDb();
  const params = await paramsPromise;
  const paramsParsed = paramsSchema.safeParse(params);
  if (!paramsParsed.success) return err('Invalid ID', 400);
  const { id } = paramsParsed.data;

  const body = await req.json();
  const { amount, notes, status, isExtraWork, lot, address, dueDate, poNumber, requestedBy, contactPhone, contactEmail } = body;

  const updateData: any = {};
  if (amount !== undefined) updateData.amount = amount;
  if (notes !== undefined) updateData.notes = notes;
  if (status !== undefined) updateData.status = status;
  if (isExtraWork !== undefined) updateData.isExtraWork = isExtraWork;
  if (lot !== undefined) updateData.lot = lot;
  if (address !== undefined) updateData.address = address;
  if (dueDate !== undefined) updateData.dueDate = dueDate;
  if (poNumber !== undefined) updateData.poNumber = poNumber;
  if (requestedBy !== undefined) updateData.requestedBy = requestedBy;
  if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
  if (contactEmail !== undefined) updateData.contactEmail = contactEmail;

  if (Object.keys(updateData).length > 0) {
    if (updateData.dueDate) {
      updateData.dueDate = new Date(updateData.dueDate).toISOString().split('T')[0];
    }
    await db.update(jobRequests).set(updateData).where(eq(jobRequests.id, id));
  }

  return ok({ success: true });
});

