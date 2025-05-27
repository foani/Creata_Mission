import { logger } from '../utils';
export { databaseManager, databaseConfig, initializeDatabase, cleanupDatabase } from './database';
export { blockchainManager, blockchainConfig, initializeBlockchain, cleanupBlockchain } from './blockchain';
export { serverConfig, createCorsMiddleware, createRateLimitMiddleware, createHelmetMiddleware, createCompressionMiddleware, createRequestLoggerMiddleware, createErrorHandlerMiddleware, createNotFoundHandlerMiddleware, logServerConfig } from './server';
export async function initializeApp() {
    const startTime = Date.now();
    logger.info('애플리케이션 초기화 시작');
    try {
        logServerConfig();
        logger.info('데이터베이스 초기화 중...');
        await initializeDatabase();
        logger.info('블록체인 초기화 중...');
        await initializeBlockchain();
        const appConfig = await getAppStatus();
        const initTime = Date.now() - startTime;
        logger.info('애플리케이션 초기화 완료', {
            duration: `${initTime}ms`,
            environment: appConfig.environment,
            version: appConfig.version
        });
        return appConfig;
    }
    catch (error) {
        logger.error('애플리케이션 초기화 실패', { error });
        throw error;
    }
}
export async function cleanupApp() {
    logger.info('애플리케이션 정리 시작');
    try {
        await cleanupBlockchain();
        await cleanupDatabase();
        logger.info('애플리케이션 정리 완료');
    }
    catch (error) {
        logger.error('애플리케이션 정리 실패', { error });
    }
}
export async function getAppStatus() {
    try {
        const dbHealthy = await databaseManager.healthCheck();
        const blockchainHealthy = await blockchainManager.healthCheck();
        let adminAddress;
        try {
            const signer = blockchainManager.getSigner();
            adminAddress = signer.address;
        }
        catch { }
        const config = {
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',
            server: {
                port: serverConfig.port,
                host: serverConfig.host
            },
            database: {
                connected: dbHealthy,
                url: databaseConfig.url
                    ? databaseConfig.url.replace(/:[^:]*@/, ':***@')
                    : ''
            },
            blockchain: {
                connected: blockchainHealthy,
                chainId: blockchainConfig.chainId,
                adminAddress
            }
        };
        return config;
    }
    catch (error) {
        logger.error('애플리케이션 상태 조회 실패', { error });
        throw error;
    }
}
export async function getHealthStatus() {
    try {
        const dbHealthy = await databaseManager.healthCheck();
        const blockchainHealthy = await blockchainManager.healthCheck();
        const isHealthy = dbHealthy && blockchainHealthy;
        return {
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            services: {
                database: dbHealthy,
                blockchain: blockchainHealthy
            }
        };
    }
    catch (error) {
        logger.error('헬스체크 실패', { error });
        return {
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            services: {
                database: false,
                blockchain: false
            }
        };
    }
}
export function validateEnvironment() {
    const required = [
        'DATABASE_URL',
        'JWT_SECRET'
    ];
    const recommended = [
        'ADMIN_PRIVATE_KEY',
        'CTA_TOKEN_ADDRESS'
    ];
    const missing = [];
    const warnings = [];
    for (const envVar of required) {
        if (!process.env[envVar]) {
            missing.push(envVar);
        }
    }
    for (const envVar of recommended) {
        if (!process.env[envVar]) {
            warnings.push(envVar);
        }
    }
    if (missing.length > 0) {
        logger.error('필수 환경 변수가 누락됨', { missing });
    }
    if (warnings.length > 0) {
        logger.warn('권장 환경 변수가 누락됨', { warnings });
    }
    return {
        valid: missing.length === 0,
        missing
    };
}
export function printConfigSummary() {
    logger.info('=== 설정 정보 요약 ===');
    logger.info(`환경: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`서버: ${serverConfig.host}:${serverConfig.port}`);
    logger.info(`데이터베이스: ${databaseConfig.url.split('@')[1] || 'localhost'}`);
    logger.info(`블록체인: ${blockchainConfig.name} (Chain ID: ${blockchainConfig.chainId})`);
    logger.info(`CTA 토큰: ${blockchainConfig.ctaTokenAddress}`);
    logger.info('========================');
}
