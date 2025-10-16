"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.users = exports.langEnum = exports.roleEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.roleEnum = (0, pg_core_1.pgEnum)('role', ['ADMIN', 'DISPATCHER', 'FOREMAN', 'CREW', 'OFFICE', 'CUSTOMER']);
exports.langEnum = (0, pg_core_1.pgEnum)('preferred_lang', ['EN', 'ES_MX']);
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    email: (0, pg_core_1.text)('email').unique().notNull(),
    phone: (0, pg_core_1.text)('phone'),
    name: (0, pg_core_1.text)('name'),
    role: (0, exports.roleEnum)('role').notNull(),
    preferredLang: (0, exports.langEnum)('preferred_lang').default('EN'),
    passwordHash: (0, pg_core_1.text)('password_hash'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
