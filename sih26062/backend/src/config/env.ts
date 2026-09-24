import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().optional().default(4000),
  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(8).optional(),

  // Phase 2: optional DB initialization from local SQL files.
  // In production, you’d run migrations separately.
  DB_INIT_ON_START: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : false))
    .default(false),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
