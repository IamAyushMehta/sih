import { z } from 'zod';
declare const envSchema: z.ZodObject<{
    PORT: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    DATABASE_URL: z.ZodString;
    JWT_SECRET: z.ZodOptional<z.ZodString>;
    DB_INIT_ON_START: z.ZodDefault<z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<boolean, string | undefined>>>;
}, z.core.$strip>;
export type Env = z.infer<typeof envSchema>;
export declare const env: Env;
export {};
//# sourceMappingURL=env.d.ts.map