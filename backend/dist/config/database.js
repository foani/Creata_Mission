import { PrismaClient } from '@prisma/client';
import { logger, DATABASE_CONFIG } from '../utils';
const getDatabaseConfig = () => {
    const environment = process.env.NODE_ENV || 'development';
    const defaultDatabaseUrl = process.env.DATABASE_URL ||
        'postgresql://postgres:password@localhost:5432/creata_mission?schema=public';
    const baseConfig = {
        url: defaultDatabaseUrl,
        maxConnections: DATABASE_CONFIG.MAX_CONNECTIONS,
        connectionTimeout: DATABASE_CONFIG.CONNECTION_TIMEOUT,
        queryTimeout: DATABASE_CONFIG.QUERY_TIMEOUT,
        idleTimeout: DATABASE_CONFIG.IDLE_TIMEOUT,
        ssl: false,
        logging: false
    };
    switch (environment) {
        case 'production':
            return {
                ...baseConfig,
                ssl: true,
                logging: false,
                maxConnections: 20
            };
        case 'test':
            return {
                ...baseConfig,
                url: process.env.TEST_DATABASE_URL ||
                    'postgresql://postgres:password@localhost:5432/creata_mission_test?schema=public',
                maxConnections: 5,
                logging: false
            };
        case 'development':
        default:
            return {
                ...baseConfig,
                logging: true,
                maxConnections: 10
            };
    }
};
class DatabaseManager {
    static instance;
    prisma = null;
    config;
    constructor() {
        this.config = getDatabaseConfig();
    }
    static getInstance() {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }
    async connect() {
        if (this.prisma) {
            return this.prisma;
        }
        try {
            this.prisma = new PrismaClient({
                datasources: {
                    db: {
                        url: this.config.url
                    }
                },
                log: this.config.logging ? [
                    { level: 'query', emit: 'event' },
                    { level: 'error', emit: 'stdout' },
                    { level: 'info', emit: 'stdout' },
                    { level: 'warn', emit: 'stdout' }
                ] : [
                    { level: 'error', emit: 'stdout' }
                ]
            });
            if (this.config.logging) {
                this.prisma.$on('query', (e) => {
                    logger.debug('Database Query', {
                        query: e.query,
                        params: e.params,
                        duration: `${e.duration}ms`
                    });
                });
            }
            await this.prisma.$connect();
            logger.info('데이터베이스 연결 성공', {
                environment: process.env.NODE_ENV,
                maxConnections: this.config.maxConnections
            });
            return this.prisma;
        }
        catch (error) {
            logger.error('데이터베이스 연결 실패', { error });
            throw error;
        }
    }
    async disconnect() {
        if (this.prisma) {
            await this.prisma.$disconnect();
            this.prisma = null;
            logger.info('데이터베이스 연결 해제');
        }
    }
    async healthCheck() {
        try {
            if (!this.prisma) {
                await this.connect();
            }
            await this.prisma.$queryRaw `SELECT 1`;
            return true;
        }
        catch (error) {
            logger.error('데이터베이스 상태 확인 실패', { error });
            return false;
        }
    }
    getClient() {
        if (!this.prisma) {
            throw new Error('데이터베이스가 초기화되지 않음. connect()를 먼저 호출하세요.');
        }
        return this.prisma;
    }
}
export const databaseManager = DatabaseManager.getInstance();
export const databaseConfig = getDatabaseConfig();
export async function initializeDatabase() {
    try {
        await databaseManager.connect();
        logger.info('데이터베이스 초기화 완료');
    }
    catch (error) {
        logger.error('데이터베이스 초기화 실패', { error });
        throw error;
    }
}
export async function cleanupDatabase() {
    try {
        await databaseManager.disconnect();
        logger.info('데이터베이스 정리 완료');
    }
    catch (error) {
        logger.error('데이터베이스 정리 실패', { error });
    }
}
