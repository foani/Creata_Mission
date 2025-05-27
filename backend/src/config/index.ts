/**
 * Config 인덱스 파일
 * 모든 설정 모듈 중앙 집중 내보내기 및 초기화
 */

import { logger } from '../utils';

// 데이터베이스 설정
export {
  databaseManager,
  databaseConfig,
  initializeDatabase,
  cleanupDatabase,
  type DatabaseConfig
} from './database';

// 블록체인 설정
export {
  blockchainManager,
  blockchainConfig,
  initializeBlockchain,
  cleanupBlockchain,
  type BlockchainConfig
} from './blockchain';

// 서버 설정
export {
  serverConfig,
  createCorsMiddleware,
  createRateLimitMiddleware,
  createHelmetMiddleware,
  createCompressionMiddleware,
  createRequestLoggerMiddleware,
  createErrorHandlerMiddleware,
  createNotFoundHandlerMiddleware,
  logServerConfig,
  type ServerConfig
} from './server';

/**
 * 전체 애플리케이션 설정 정보
 */
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

/**
 * 전체 시스템 초기화
 * 서버 시작 시 호출되는 메인 초기화 함수
 */
export async function initializeApp(): Promise<AppConfig> {
  const startTime = Date.now();
  logger.info('애플리케이션 초기화 시작');

  try {
    // 1. 서버 설정 로깅
    logServerConfig();

    // 2. 데이터베이스 초기화
    logger.info('데이터베이스 초기화 중...');
    await initializeDatabase();

    // 3. 블록체인 초기화
    logger.info('블록체인 초기화 중...');
    await initializeBlockchain();

    // 4. 시스템 상태 확인
    const appConfig = await getAppStatus();
    
    const initTime = Date.now() - startTime;
    logger.info('애플리케이션 초기화 완료', {
      duration: `${initTime}ms`,
      environment: appConfig.environment,
      version: appConfig.version
    });

    return appConfig;

  } catch (error) {
    logger.error('애플리케이션 초기화 실패', { error });
    throw error;
  }
}

/**
 * 전체 시스템 정리
 * 서버 종료 시 호출되는 정리 함수
 */
export async function cleanupApp(): Promise<void> {
  logger.info('애플리케이션 정리 시작');

  try {
    // 1. 블록체인 연결 정리
    await cleanupBlockchain();

    // 2. 데이터베이스 연결 정리
    await cleanupDatabase();

    logger.info('애플리케이션 정리 완료');

  } catch (error) {
    logger.error('애플리케이션 정리 실패', { error });
  }
}

/**
 * 애플리케이션 상태 조회
 */
export async function getAppStatus(): Promise<AppConfig> {
  try {
    const dbHealthy = await databaseManager.healthCheck();
    const blockchainHealthy = await blockchainManager.healthCheck();
    let adminAddress: string | undefined;
    try {
      const signer = blockchainManager.getSigner();
      adminAddress = signer.address;
    } catch {}

    const config: AppConfig = {
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

  } catch (error) {
    logger.error('애플리케이션 상태 조회 실패', { error });
    throw error;
  }
}

/**
 * 헬스체크 API용 간단한 상태 정보
 */
export async function getHealthStatus(): Promise<{
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: boolean;
    blockchain: boolean;
  };
}> {
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

  } catch (error) {
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

/**
 * 환경 변수 검증
 */
export function validateEnvironment(): { valid: boolean; missing: string[] } {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET'
  ];

  const recommended = [
    'ADMIN_PRIVATE_KEY',
    'CTA_TOKEN_ADDRESS'
  ];

  const missing: string[] = [];
  const warnings: string[] = [];

  // 필수 환경 변수 확인
  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // 권장 환경 변수 확인
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

/**
 * 설정 정보 요약 출력
 */
export function printConfigSummary(): void {
  logger.info('=== 설정 정보 요약 ===');
  logger.info(`환경: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`서버: ${serverConfig.host}:${serverConfig.port}`);
  logger.info(`데이터베이스: ${databaseConfig.url.split('@')[1] || 'localhost'}`);
  logger.info(`블록체인: ${blockchainConfig.name} (Chain ID: ${blockchainConfig.chainId})`);
  logger.info(`CTA 토큰: ${blockchainConfig.ctaTokenAddress}`);
  logger.info('========================');
}