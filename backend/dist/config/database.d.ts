import { PrismaClient } from '@prisma/client';
export interface DatabaseConfig {
    url: string;
    maxConnections: number;
    connectionTimeout: number;
    queryTimeout: number;
    idleTimeout: number;
    ssl: boolean;
    logging: boolean;
}
declare class DatabaseManager {
    private static instance;
    private prisma;
    private config;
    private constructor();
    static getInstance(): DatabaseManager;
    connect(): Promise<PrismaClient>;
    disconnect(): Promise<void>;
    healthCheck(): Promise<boolean>;
    getClient(): PrismaClient;
}
export declare const databaseManager: DatabaseManager;
export declare const databaseConfig: DatabaseConfig;
export declare function initializeDatabase(): Promise<void>;
export declare function cleanupDatabase(): Promise<void>;
export {};
