"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = exports.db = void 0;
require("dotenv/config");
const schema = __importStar(require("./schema"));
// Postgres (postgres-js)
const postgres_1 = __importDefault(require("postgres"));
const postgres_js_1 = require("drizzle-orm/postgres-js");
// SQLite (better-sqlite3)
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const better_sqlite3_2 = require("drizzle-orm/better-sqlite3");
const url = process.env.DATABASE_URL;
const useSqlite = !url || !url.startsWith('postgres');
// Create a singleton connection
const globalForDb = globalThis;
let client;
let db;
// SQLite for dev (no Docker needed)
if (useSqlite) {
    const sqlitePath = (_a = process.env.SQLITE_PATH) !== null && _a !== void 0 ? _a : 'dev.db';
    const sqliteClient = (_b = globalForDb.sqliteClient) !== null && _b !== void 0 ? _b : new better_sqlite3_1.default(sqlitePath);
    if (process.env.NODE_ENV !== 'production') {
        globalForDb.sqliteClient = sqliteClient;
    }
    exports.client = client = sqliteClient;
    exports.db = db = (0, better_sqlite3_2.drizzle)(sqliteClient, { schema });
}
else {
    // Postgres for production
    const pgClient = (_c = globalForDb.pgClient) !== null && _c !== void 0 ? _c : (0, postgres_1.default)(url, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
    });
    if (process.env.NODE_ENV !== 'production') {
        globalForDb.pgClient = pgClient;
    }
    exports.client = client = pgClient;
    exports.db = db = (0, postgres_js_1.drizzle)(pgClient, { schema });
}
