import 'dotenv/config';
import { db, client } from '../db';
import { users, services, builders, communities, modelPlans, contractRates, crews } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function upsertUser(email: string, data: Omit<typeof users.$inferInsert, 'email'>) {
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length) { await db.update(users).set(data).where(eq(users.email, email)); return existing[0]; }
  const [row] = await db.insert(users).values({ email, ...data }).returning(); return row;
}
async function getOrCreateCommunity(builderId: string, name: string) {
  const rows = await db.select().from(communities).where(and(eq(communities.builderId, builderId), eq(communities.name, name)));
  if (rows.length) return rows[0];
  const [row] = await db.insert(communities).values({ builderId, name }).returning(); return row;
}
async function getOrCreatePlan(builderId: string, code: string, name: string, sqft: number, defaults: any) {
  const rows = await db.select().from(modelPlans).where(and(eq(modelPlans.builderId, builderId), eq(modelPlans.code, code)));
  if (rows.length) { await db.update(modelPlans).set({ name, sqft: String(sqft), defaults }).where(and(eq(modelPlans.builderId, builderId), eq(modelPlans.code, code))); return rows[0]; }
  const [row] = await db.insert(modelPlans).values({ builderId, code, name, sqft: String(sqft), defaults }).returning(); return row;
}

async function seed() {
  const passwordHash = await bcrypt.hash('password', 10);

  // Users
  const admin = await upsertUser('admin@lunas.com', { name: 'Admin', role: 'ADMIN', preferredLang: 'EN', passwordHash });
  await upsertUser('dispatcher@lunas.com', { name: 'Dispatcher', role: 'DISPATCHER', preferredLang: 'EN', passwordHash });
  const anahi = await upsertUser('anahi@lunas.com', { name: 'Anahi', role: 'FOREMAN', preferredLang: 'ES_MX', passwordHash });
  const chayo = await upsertUser('chayo@lunas.com', { name: 'Chayo', role: 'FOREMAN', preferredLang: 'ES_MX', passwordHash });
  const blanca = await upsertUser('blanca@lunas.com', { name: 'Blanca', role: 'FOREMAN', preferredLang: 'ES_MX', passwordHash });
  const raudel = await upsertUser('raudel@lunas.com', { name: 'Raudel', role: 'FOREMAN', preferredLang: 'ES_MX', passwordHash });
  const francisco = await upsertUser('francisco@lunas.com', { name: 'Francisco', role: 'FOREMAN', preferredLang: 'ES_MX', passwordHash });

  // Services
  const svc = async (code: string, name: string, unitKind: 'PER_JOB'|'PER_SQFT'|'PER_UNIT') => {
    const s = await db.select().from(services).where(eq(services.code, code));
    if (s.length) { await db.update(services).set({ name, unitKind }).where(eq(services.code, code)); return s[0]; }
    const [row] = await db.insert(services).values({ code, name, unitKind }).returning(); return row;
  };
  await svc('ROUGH','Rough Clean','PER_JOB');
  await svc('FINAL','Final Clean','PER_JOB');
  await svc('QA','QA Clean','PER_JOB');
  await svc('PAINT_SWEEP','Paint Sweep','PER_SQFT');
  await svc('FRAME_SWEEP','Frame Sweep','PER_SQFT');
  await svc('POWER_WASH','Power Wash','PER_JOB');
  const tubsWindows = await svc('TUBS_WINDOWS','Tubs & Windows','PER_UNIT');

  // Builder
  const b = await db.select().from(builders).where(eq(builders.name, 'Pulte'));
  const builder = b.length ? b[0] : (await db.insert(builders).values({ name: 'Pulte' }).returning())[0];

  // Communities
  const liberty = await getOrCreateCommunity(builder.id, 'Liberty');
  const paragon = await getOrCreateCommunity(builder.id, 'Paragon');
  const inspirada = await getOrCreateCommunity(builder.id, 'Inspirada 6/4');

  // Model Plans
  const planA = await getOrCreatePlan(builder.id, 'A', 'Plan A', 2000, { windows: 10, tubs: 2 });
  const planB = await getOrCreatePlan(builder.id, 'B', 'Plan B', 2500, { windows: 15, tubs: 3 });
  const planC = await getOrCreatePlan(builder.id, 'C', 'Plan C', 3000, { windows: 20, tubs: 4 });
  const planD = await getOrCreatePlan(builder.id, 'D', 'Plan D', 3500, { windows: 25, tubs: 5 });
  const planE = await getOrCreatePlan(builder.id, 'E', 'Plan E', 4000, { windows: 30, tubs: 6 });

  // TODO: add contractRates & crews here similarly (select→insert/update)
}

seed()
  .then(async () => { console.log('✅ Seed completed'); await client.end(); process.exit(0); })
  .catch(async (e) => { console.error('❌ Error seeding database:', e); await client.end(); process.exit(1); });
