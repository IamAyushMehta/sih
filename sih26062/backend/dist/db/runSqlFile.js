"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSqlFile = runSqlFile;
const promises_1 = __importDefault(require("fs/promises"));
const pool_1 = require("./pool");
async function runSqlFile(filePath) {
    const sql = await promises_1.default.readFile(filePath, 'utf8');
    // pg supports multi-statement strings via the simple query protocol.
    await pool_1.pool.query(sql);
}
//# sourceMappingURL=runSqlFile.js.map