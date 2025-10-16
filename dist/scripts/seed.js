"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const bcrypt_1 = __importDefault(require("bcrypt"));
async function upsertUser(email, data) {
    const existing = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
    if (existing.length) {
        await db_1.db.update(schema_1.users).set(data).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        return existing[0];
    }
    const [row] = await db_1.db.insert(schema_1.users).values(Object.assign({ email }, data)).returning();
    return row;
}
async function getOrCreateCommunity(builderId, name) {
    const rows = await db_1.db.select().from(schema_1.communities).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.communities.builderId, builderId), (0, drizzle_orm_1.eq)(schema_1.communities.name, name)));
    if (rows.length)
        return rows[0];
    const [row] = await db_1.db.insert(schema_1.communities).values({ builderId, name }).returning();
    return row;
}
async function getOrCreatePlan(builderId, code, name, sqft, defaults) {
    const rows = await db_1.db.select().from(schema_1.modelPlans).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.modelPlans.builderId, builderId), (0, drizzle_orm_1.eq)(schema_1.modelPlans.code, code)));
    if (rows.length) {
        await db_1.db.update(schema_1.modelPlans).set({ name, sqft: String(sqft), defaults }).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.modelPlans.builderId, builderId), (0, drizzle_orm_1.eq)(schema_1.modelPlans.code, code)));
        return rows[0];
    }
    const [row] = await db_1.db.insert(schema_1.modelPlans).values({ builderId, code, name, sqft: String(sqft), defaults }).returning();
    return row;
}
async function seed() {
    const passwordHash = await bcrypt_1.default.hash('password', 10);
    // Users
    const admin = await upsertUser('admin@lunas.com', { name: 'Admin', role: 'ADMIN', preferredLang: 'EN', passwordHash });
    await upsertUser('dispatcher@lunas.com', { name: 'Dispatcher', role: 'DISPATCHER', preferredLang: 'EN', passwordHash });
    const anahi = await upsertUser('anahi@lunas.com', { name: 'Anahi', role: 'FOREMAN', preferredLang: 'ES_MX', passwordHash });
    const chayo = await upsertUser('chayo@lunas.com', { name: 'Chayo', role: 'FOREMAN', preferredLang: 'ES_MX', passwordHash });
    const blanca = await upsertUser('blanca@lunas.com', { name: 'Blanca', role: 'FOREMAN', preferredLang: 'ES_MX', passwordHash });
    const raudel = await upsertUser('raudel@lunas.com', { name: 'Raudel', role: 'FOREMAN', preferredLang: 'ES_MX', passwordHash });
    const francisco = await upsertUser('francisco@lunas.com', { name: 'Francisco', role: 'FOREMAN', preferredLang: 'ES_MX', passwordHash });
    // Services
    const svc = async (code, name, unitKind) => {
        const s = await db_1.db.select().from(schema_1.services).where((0, drizzle_orm_1.eq)(schema_1.services.code, code));
        if (s.length) {
            await db_1.db.update(schema_1.services).set({ name, unitKind }).where((0, drizzle_orm_1.eq)(schema_1.services.code, code));
            return s[0];
        }
        const [row] = await db_1.db.insert(schema_1.services).values({ code, name, unitKind }).returning();
        return row;
    };
    await svc('ROUGH', 'Rough Clean', 'PER_JOB');
    await svc('FINAL', 'Final Clean', 'PER_JOB');
    await svc('QA', 'QA Clean', 'PER_JOB');
    await svc('PAINT_SWEEP', 'Paint Sweep', 'PER_SQFT');
    await svc('FRAME_SWEEP', 'Frame Sweep', 'PER_SQFT');
    await svc('POWER_WASH', 'Power Wash', 'PER_JOB');
    const tubsWindows = await svc('TUBS_WINDOWS', 'Tubs & Windows', 'PER_UNIT');
    // Builder
    const b = await db_1.db.select().from(schema_1.builders).where((0, drizzle_orm_1.eq)(schema_1.builders.name, 'Pulte'));
    const builder = b.length ? b[0] : (await db_1.db.insert(schema_1.builders).values({ name: 'Pulte' }).returning())[0];
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
    .then(async () => { console.log('✅ Seed completed'); await db_1.client.end(); process.exit(0); })
    .catch(async (e) => { console.error('❌ Error seeding database:', e); await db_1.client.end(); process.exit(1); });
