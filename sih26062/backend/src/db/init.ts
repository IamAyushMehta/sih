import path from 'path';
import { pool } from './pool';
import { runSqlFile } from './runSqlFile';

function sqlPathFromRepo(relPathFromSih26062: string): string {
  // __dirname is backend/src/db (dev) or backend/dist/db (compiled).
  // ../../../database/... resolves to sih26062/database/... in both cases.
  return path.resolve(__dirname, `../../../${relPathFromSih26062}`);
}

async function isInitialized(): Promise<boolean> {
  const res = await pool.query(
    "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'indent_status') AS ok;"
  );
  return Boolean(res.rows[0]?.ok);
}

export async function initDbIfNeeded(force = false): Promise<void> {
  if (!force) {
    const ok = await isInitialized();
    if (ok) return;
  }

  const schemaPath = sqlPathFromRepo('database/schema.sql');
  const seedPath = sqlPathFromRepo('database/seed.sql');

  await runSqlFile(schemaPath);
  await runSqlFile(seedPath);
}
