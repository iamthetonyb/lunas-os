import 'server-only';

import { getDb } from '@/lib/db/get-db';
import { jobRequestServices, assignments, crews, dispatchBatches } from '@/db/schema';
import { and, eq, lte, isNull, inArray } from 'drizzle-orm';
import { sendSms, sendEmail } from './notifications';

const translations = {
  en: {
    schedule_notification: 'Lunas schedule for {{date}}: {{count}} jobs. Run sheet: {{link}}',
  },
  'es-mx': {
    schedule_notification: 'Horario Lunas para {{date}}: {{count}} trabajos. Hoja de ruta: {{link}}',
  },
};

export async function autoDraft(date: Date) {
  const db = await getDb();

  try {
    const allJrs = await db.query.jobRequestServices.findMany({
      where: lte(jobRequestServices.walkTime, date.toISOString()),
      with: {
        service: true,
        jobRequest: {
          with: {
            community: true,
          },
        },
      },
    });

    const allAssignments = await db.query.assignments.findMany();
    const assignedJrsIds = new Set(allAssignments.map(a => a.jobRequestServiceId));

    const unassignedJobRequestServices = allJrs.filter(jrs => !assignedJrsIds.has(jrs.id));

    const availableCrews = await db.query.crews.findMany();

    // Group by Community -> Service
    const groupedByCommunity = unassignedJobRequestServices.reduce((acc, jrs) => {
      const communityId = (jrs as any).jobRequest?.communityId;
      if (!communityId) return acc;
      if (!acc[communityId]) {
        acc[communityId] = {};
      }
      const serviceId = jrs.serviceId;
      if (!serviceId) return acc;
      if (!acc[communityId][serviceId]) {
        acc[communityId][serviceId] = [];
      }
      acc[communityId][serviceId].push(jrs);
      return acc;
    }, {} as { [communityId: string]: { [serviceId: string]: typeof unassignedJobRequestServices } });

    const draftAssignments = [];

    for (const communityId in groupedByCommunity) {
      for (const serviceId in groupedByCommunity[communityId]) {
        const jrsGroup = groupedByCommunity[communityId][serviceId];
        const requiredSkills = (jrsGroup[0] as any).service?.code;

        const suitableCrews = availableCrews.filter(crew =>
          crew.skills?.includes(requiredSkills) &&
          (crew.capacityPerDay || 0) > 0 // A simple capacity check
        );

        if (suitableCrews.length > 0) {
          // Simple round-robin assignment for now
          const crew = suitableCrews[0];

          for (const jrs of jrsGroup) {
            const newAssignment = {
              jobRequestServiceId: jrs.id,
              crewId: crew.id,
              status: 'DRAFT' as const,
            };
            draftAssignments.push(newAssignment);
          }
        }
      }
    }

    if (draftAssignments.length > 0) {
      await db.insert(assignments).values(draftAssignments);
    }

    return draftAssignments;
  } catch (error) {
    console.error('[scheduling] autoDraft error:', error);
    throw error;
  }
}

export async function approveAndSend(assignmentIds: string[]) {
  const db = await getDb();

  // 1. Fetch assignments with their crew and foreman info
  const assignmentsToApprove = await db.query.assignments.findMany({
    where: inArray(assignments.id, assignmentIds),
    with: {
      crew: {
        with: {
          foreman: true,
        },
      },
      jobRequestService: {
        with: {
          service: true,
        }
      }
    },
  });

  if (assignmentsToApprove.length === 0) return null;

  // 2. Group these assignments by (Crew + Foreman)
  // We use crew.name and foreman.name as the grouping key
  const groups = new Map<string, typeof assignmentsToApprove>();

  for (const assignment of assignmentsToApprove) {
    const crewName = (assignment as any).crew?.name || 'Unassigned Crew';
    const foremanName = (assignment as any).crew?.foreman?.name || 'Unassigned';
    const key = `${crewName}|${foremanName}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(assignment);
  }

  const results = [];
  const today = new Date().toISOString().split('T')[0];

  // 3. For each group, create or find a batch and update assignments
  for (const [key, groupAssignments] of groups.entries()) {
    const [crewName, foremanName] = key.split('|');

    // Check if a batch already exists for this crew/foreman today that is still in SENT status
    // (This helps with the "live" feel and avoids duplicates if sent in multiple clicks)
    const existingBatch = await db.query.dispatchBatches.findFirst({
      where: and(
        eq(dispatchBatches.serviceDate, today),
        eq(dispatchBatches.crewName, crewName),
        eq(dispatchBatches.foremanName, foremanName),
        eq(dispatchBatches.status, 'SENT')
      )
    });

    let batchId: string;

    if (existingBatch) {
      batchId = existingBatch.id;
    } else {
      const newBatch = await db.insert(dispatchBatches).values({
        serviceDate: today,
        status: 'SENT',
        crewName,
        foremanName,
      }).returning();
      batchId = newBatch[0].id;
    }

    // Update these assignments to point to this batch
    await db.update(assignments).set({
      status: 'SENT',
      dispatchBatchId: batchId,
    }).where(inArray(assignments.id, groupAssignments.map(a => a.id)));

    // 4. Send notifications for this group
    const foreman = (groupAssignments[0] as any).crew?.foreman;
    if (foreman) {
      const lang = foreman.preferredLang?.toLowerCase() || 'en';
      const t = (key: string, replacements: { [key: string]: string }) => {
        // @ts-ignore
        let translation = translations[lang]?.[key] || translations.en[key];
        for (const placeholder in replacements) {
          translation = translation.replace(`{{${placeholder}}}`, replacements[placeholder]);
        }
        return translation;
      };

      const message = t('schedule_notification', {
        date: new Date().toLocaleDateString(),
        count: String(groupAssignments.length),
        link: `${process.env.NEXTAUTH_URL || 'http://localhost:4010'}/dispatch/${batchId}`,
      });

      if (foreman.phone) {
        await sendSms(foreman.phone, message);
      }
      if (foreman.email) {
        await sendEmail(foreman.email, 'Lunas Schedule', message);
      }
    }

    results.push({ batchId, count: groupAssignments.length });
  }

  return results;
}
