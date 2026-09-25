"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDbIfNeeded = initDbIfNeeded;
const path_1 = __importDefault(require("path"));
const pool_1 = require("./pool");
const runSqlFile_1 = require("./runSqlFile");
function sqlPathFromRepo(relPathFromSih26062) {
    // __dirname is backend/src/db (dev) or backend/dist/db (compiled).
    // ../../../database/... resolves to sih26062/database/... in both cases.
    return path_1.default.resolve(__dirname, `../../../${relPathFromSih26062}`);
}
async function isInitialized() {
    const res = await pool_1.pool.query("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'indent_status') AS ok;");
    return Boolean(res.rows[0]?.ok);
}
async function initDbIfNeeded(force = false) {
    if (!force) {
        const ok = await isInitialized();
        if (ok)
            return;
    }
    const schemaPath = sqlPathFromRepo('database/schema.sql');
    const seedPath = sqlPathFromRepo('database/seed.sql');
    await (0, runSqlFile_1.runSqlFile)(schemaPath);
    await (0, runSqlFile_1.runSqlFile)(seedPath);
}
//# sourceMappingURL=init.js.map