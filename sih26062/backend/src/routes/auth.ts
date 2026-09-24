import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { pool } from '../db/pool';
import { env } from '../config/env';

export const authRouter = Router();

const registerSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'PLANNER', 'LOGISTICS', 'MEDICAL', 'EMERGENCY']).optional(),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function signToken(userId: string, role: string) {
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET is required');

  return jwt.sign(
    { sub: userId, role },
    env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

authRouter.post('/register', async (req, res) => {
  const input = registerSchema.safeParse(req.body);
  if (!input.success) {
    return res.status(400).json({ error: input.error.flatten() });
  }

  const { username, password, role } = input.data;

  const existingUsers = await pool.query('SELECT COUNT(*)::int AS cnt FROM users;');
  const cnt = existingUsers.rows[0]?.cnt ?? 0;

  // Security rule for hackathon/demo: allow public bootstrap only when there are no users.
  const resolvedRole =
    cnt === 0 ? (role ?? 'ADMIN') : (role ?? null);

  if (cnt !== 0) {
    return res.status(403).json({ error: 'Registration is restricted after bootstrap.' });
  }

  if (!resolvedRole || resolvedRole !== 'ADMIN') {
    return res.status(403).json({ error: 'First user must be ADMIN.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const r = await pool.query(
    'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role;',
    [username, passwordHash, resolvedRole]
  );

  const user = r.rows[0];
  const token = signToken(String(user.id), String(user.role));

  res.json({ token, user });
});

authRouter.post('/login', async (req, res) => {
  const input = loginSchema.safeParse(req.body);
  if (!input.success) {
    return res.status(400).json({ error: input.error.flatten() });
  }

  const { username, password } = input.data;

  const r = await pool.query(
    'SELECT id, username, role, password_hash FROM users WHERE username = $1;',
    [username]
  );

  if (r.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = r.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);

  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(String(user.id), String(user.role));
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});
