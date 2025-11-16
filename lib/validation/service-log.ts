import { z } from 'zod';

export const serviceLogInputSchema = z.object({
  date: z.coerce.date(),
  projectName: z.string().max(255).optional().nullable(),
  builder: z.string().max(255).optional().nullable(),
  community: z.string().max(255).optional().nullable(),
  address: z.string().max(512).optional().nullable(),
  lot: z.string().max(128).optional().nullable(),
  unitLot: z.string().max(128).optional().nullable(),
  serviceType: z.string().max(255).optional().nullable(),
  category: z.string().max(255).optional().nullable(),
  status: z.string().max(255).optional().nullable(),
  timeIn: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time format').optional().nullable(),
  timeOut: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time format').optional().nullable(),
  hours: z.coerce.number().optional().nullable(),
  team: z.array(z.string().max(255)).optional().nullable(),
  extras: z.string().optional().nullable(),
  supervisor: z.string().max(255).optional().nullable(),
  foreman: z.string().max(255).optional().nullable(),
  crewLeader: z.string().max(255).optional().nullable(),
  explainWork: z.string().optional().nullable(),
  amount: z.coerce.number().optional().nullable(),
  source: z.string().max(128).optional().nullable(),
  photos: z.array(z.string().url()).optional().nullable(),
});

export type ServiceLogInput = z.infer<typeof serviceLogInputSchema>;
export type ServiceLogFormValues = z.input<typeof serviceLogInputSchema>;
