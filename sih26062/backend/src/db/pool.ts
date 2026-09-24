import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const pool = new Pool({
  connectionString: databaseUrl ?? requireEnv('DATABASE_URL'),
  // For a hackathon demo, a small pool is fine.
  max: Number(process.env.PG_POOL_MAX ?? 5),
});
