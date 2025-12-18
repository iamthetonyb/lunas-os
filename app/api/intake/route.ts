import { z } from 'zod';
import { getDb } from '@/lib/db/get-db';
import { jobRequests, jobRequestServices } from '@/db/schema';
import { ok, err, safe } from '@/lib/api/http';
import { requireMembership } from '@/lib/auth/guards';
import { publishOrgEvent } from '@/lib/ably';

export const runtime = 'nodejs';

const intakePayloadSchema = z.object({
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
  contact: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
  receivedVia: z.string().optional().nullable(),
  serviceIds: z.array(z.string().uuid()).min(1, 'Select at least one service'),
});

export const POST = safe(async (req, context) => {
  const membership = await requireMembership(['admin', 'backoffice', 'contractor']);
  const db = await getDb();
  const raw = await req.json();
  const parsed = intakePayloadSchema.safeParse(raw);

  if (!parsed.success) {
    return err('Invalid payload', 400, parsed.error.flatten());
  }

  const {
    serviceIds,
    walkTime,
    contact,
    dueDate,
    requestedBy,
    notes,
    poNumber,
    receivedVia,
    ...rest
  } = parsed.data;

  const dueDateISO = dueDate.toISOString().split('T')[0];

  const result = await db.transaction(async (tx) => {
    const [request] = await tx
      .insert(jobRequests)
      .values({
        builderId: rest.builderId,
        communityId: rest.communityId,
        modelPlanId: rest.modelPlanId ?? null,
        lot: rest.lot,
        address: rest.address ?? null,
        dueDate: dueDateISO,
        requestedBy: requestedBy ?? null,
        notes: notes ?? null,
        poNumber: poNumber ?? null,
        receivedVia: receivedVia ?? 'app',
        contactPhone: contact ?? null,
        createdById: membership.userId,
      })
      .returning();

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

  // Broadcast update
  await publishOrgEvent(membership.orgId, 'intake.updated', { requestId: result.id });

  return ok(result, { status: 201 });
});
