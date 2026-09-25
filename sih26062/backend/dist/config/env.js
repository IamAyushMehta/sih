"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().optional().default(4000),
    DATABASE_URL: zod_1.z.string().min(1),
    JWT_SECRET: zod_1.z.string().min(8).optional(),
    // Phase 2: optional DB initialization from local SQL files.
    // In production, you’d run migrations separately.
    DB_INIT_ON_START: zod_1.z
        .string()
        .optional()
        .transform((v) => (v === 'true' ? true : false))
        .default(false),
});
exports.env = envSchema.parse(process.env);
//# sourceMappingURL=env.js.map