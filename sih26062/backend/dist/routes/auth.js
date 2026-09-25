"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const pool_1 = require("../db/pool");
const env_1 = require("../config/env");
exports.authRouter = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    username: zod_1.z.string().min(3),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum(['ADMIN', 'PLANNER', 'LOGISTICS', 'MEDICAL', 'EMERGENCY']).optional(),
});
const loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1),
    password: zod_1.z.string().min(1),
});
function signToken(userId, role) {
    if (!env_1.env.JWT_SECRET)
        throw new Error('JWT_SECRET is required');
    return jsonwebtoken_1.default.sign({ sub: userId, role }, env_1.env.JWT_SECRET, { expiresIn: '8h' });
}
exports.authRouter.post('/register', async (req, res) => {
    const input = registerSchema.safeParse(req.body);
    if (!input.success) {
        return res.status(400).json({ error: input.error.flatten() });
    }
    const { username, password, role } = input.data;
    const existingUsers = await pool_1.pool.query('SELECT COUNT(*)::int AS cnt FROM users;');
    const cnt = existingUsers.rows[0]?.cnt ?? 0;
    // Security rule for hackathon/demo: allow public bootstrap only when there are no users.
    const resolvedRole = cnt === 0 ? (role ?? 'ADMIN') : (role ?? null);
    if (cnt !== 0) {
        return res.status(403).json({ error: 'Registration is restricted after bootstrap.' });
    }
    if (!resolvedRole || resolvedRole !== 'ADMIN') {
        return res.status(403).json({ error: 'First user must be ADMIN.' });
    }
    const passwordHash = await bcrypt_1.default.hash(password, 10);
    const r = await pool_1.pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role;', [username, passwordHash, resolvedRole]);
    const user = r.rows[0];
    const token = signToken(String(user.id), String(user.role));
    res.json({ token, user });
});
exports.authRouter.post('/login', async (req, res) => {
    const input = loginSchema.safeParse(req.body);
    if (!input.success) {
        return res.status(400).json({ error: input.error.flatten() });
    }
    const { username, password } = input.data;
    const r = await pool_1.pool.query('SELECT id, username, role, password_hash FROM users WHERE username = $1;', [username]);
    if (r.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = r.rows[0];
    const ok = await bcrypt_1.default.compare(password, user.password_hash);
    if (!ok) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken(String(user.id), String(user.role));
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});
//# sourceMappingURL=auth.js.map