import { Router } from 'express';
import { pool } from '../db/pool';

export const dbRouter = Router();

dbRouter.get('/health', async (_req, res) => {
  const r = await pool.query('SELECT now() as now;');
  res.json({ ok: true, dbNow: r.rows[0]?.now });
});
