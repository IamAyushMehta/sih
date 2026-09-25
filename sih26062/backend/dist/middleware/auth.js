"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
function requireAuth(req, res, next) {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) {
        return res.status(401).json({ error: 'Missing token' });
    }
    if (!env_1.env.JWT_SECRET) {
        return res.status(500).json({ error: 'Server JWT_SECRET misconfigured' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        if (!decoded.sub || !decoded.role)
            throw new Error('Bad token payload');
        req.user = { userId: decoded.sub, role: decoded.role };
        next();
    }
    catch (_e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
function requireRole(allowed) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'Missing auth context' });
        if (!allowed.includes(req.user.role))
            return res.status(403).json({ error: 'Forbidden' });
        next();
    };
}
//# sourceMappingURL=auth.js.map