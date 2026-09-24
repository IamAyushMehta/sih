import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';

export type AuthedRequest = Request & { user?: { userId: string; role: string } };

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  if (!env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server JWT_SECRET misconfigured' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub?: string; role?: string };
    if (!decoded.sub || !decoded.role) throw new Error('Bad token payload');

    req.user = { userId: decoded.sub, role: decoded.role };
    next();
  } catch (_e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(allowed: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Missing auth context' });
    if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
