import { Request, Response, NextFunction } from 'express';
export type AuthedRequest = Request & {
    user?: {
        userId: string;
        role: string;
    };
};
export declare function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireRole(allowed: string[]): (req: AuthedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=auth.d.ts.map