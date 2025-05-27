export { databaseManager, databaseConfig, initializeDatabase, cleanupDatabase, type DatabaseConfig } from './database';
export { blockchainManager, blockchainConfig, initializeBlockchain, cleanupBlockchain, type BlockchainConfig } from './blockchain';
export { serverConfig, createCorsMiddleware, createRateLimitMiddleware, createHelmetMiddleware, createCompressionMiddleware, createRequestLoggerMiddleware, createErrorHandlerMiddleware, createNotFoundHandlerMiddleware, logServerConfig, type ServerConfig } from './server';
export interface AppConfig {
    environment: string;
    version: string;
    server: {
        port: number;
        host: string;
    };
    database: {
        connected: boolean;
        url: string;
    };
    blockchain: {
        connected: boolean;
        chainId: number;
        adminAddress?: string;
    };
}
export declare function initializeApp(): Promise<AppConfig>;
export declare function cleanupApp(): Promise<void>;
export declare function getAppStatus(): Promise<AppConfig>;
export declare function getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    uptime: number;
    services: {
        database: boolean;
        blockchain: boolean;
    };
}>;
export declare function validateEnvironment(): {
    valid: boolean;
    missing: string[];
};
export declare function printConfigSummary(): void;
