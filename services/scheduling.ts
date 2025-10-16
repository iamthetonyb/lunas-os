import { db } from '@/db';
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
    const communityId = jrs.jobRequest.communityId;
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
      const requiredSkills = jrsGroup[0].service.code;

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
            status: 'DRAFT',
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
}

export async function approveAndSend(assignmentIds: string[]) {
  // Create a dispatch batch
  const newDispatchBatch = await db.insert(dispatchBatches).values({
    serviceDate: new Date(),
    status: 'SENT',
  }).returning();

  // Update assignments
  await db.update(assignments).set({
    status: 'SENT',
    dispatchBatchId: newDispatchBatch[0].id,
  }).where(inArray(assignments.id, assignmentIds));

  // Get assignments with crew and user info
  const updatedAssignments = await db.query.assignments.findMany({
    where: inArray(assignments.id, assignmentIds),
    with: {
      crew: {
        with: {
          foreman: true,
        },
      },
    },
  });

  // Group assignments by crew
  const assignmentsByCrew = updatedAssignments.reduce((acc, assignment) => {
    const crewId = assignment.crewId;
    if (!crewId) return acc;
    if (!acc[crewId]) {
      acc[crewId] = [];
    }
    acc[crewId].push(assignment);
    return acc;
  }, {} as { [crewId: string]: typeof updatedAssignments });

  // Send notifications
  for (const crewId in assignmentsByCrew) {
    const crewAssignments = assignmentsByCrew[crewId];
    const foreman = crewAssignments[0].crew.foreman;
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
      count: String(crewAssignments.length),
      link: `http://localhost:3000/dispatch/${newDispatchBatch[0].id}`, // This should be a public URL
    });

    if (foreman?.phone) {
      await sendSms(foreman.phone, message);
    }
    if (foreman?.email) {
      await sendEmail(foreman.email, 'Lunas Schedule', message);
    }
  }

  return newDispatchBatch[0];
}
