import fs from 'fs/promises';
import { pool } from './pool';

export async function runSqlFile(filePath: string): Promise<void> {
  const sql = await fs.readFile(filePath, 'utf8');
  // pg supports multi-statement strings via the simple query protocol.
  await pool.query(sql);
}
