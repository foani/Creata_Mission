import { Application } from 'express';
import { PrismaClient } from '@prisma/client';
declare const prisma: PrismaClient<{
    log: ("info" | "query" | "warn" | "error")[];
}, never, import("@prisma/client/runtime/library.js").DefaultArgs>;
declare const app: Application;
declare function startServer(): Promise<void>;
export { app, prisma, startServer };
