"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const pg_1 = require("pg");
const databaseUrl = process.env.DATABASE_URL;
function requireEnv(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing required env var: ${name}`);
    return v;
}
exports.pool = new pg_1.Pool({
    connectionString: databaseUrl ?? requireEnv('DATABASE_URL'),
    // For a hackathon demo, a small pool is fine.
    max: Number(process.env.PG_POOL_MAX ?? 5),
});
//# sourceMappingURL=pool.js.map