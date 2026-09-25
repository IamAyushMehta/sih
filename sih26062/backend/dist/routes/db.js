"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbRouter = void 0;
const express_1 = require("express");
const pool_1 = require("../db/pool");
exports.dbRouter = (0, express_1.Router)();
exports.dbRouter.get('/health', async (_req, res) => {
    const r = await pool_1.pool.query('SELECT now() as now;');
    res.json({ ok: true, dbNow: r.rows[0]?.now });
});
//# sourceMappingURL=db.js.map