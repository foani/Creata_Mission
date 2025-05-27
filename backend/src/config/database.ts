/**
 * 데이터베이스 설정
 * PostgreSQL + Prisma ORM 설정
 */

import { PrismaClient } from '@prisma/client';
import { logger, DATABASE_CONFIG } from '../utils';

/**
 * 데이터베이스 연결 설정 인터페이스
 */
export interface DatabaseConfig {
  url: string;
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
  idleTimeout: number;
  ssl: boolean;
  logging: boolean;
}

/**
 * 환경별 데이터베이스 설정
 */
const getDatabaseConfig = (): DatabaseConfig => {
  const environment = process.env.NODE_ENV || 'development';
  
  // 하드코딩된 기본 DATABASE_URL (개발용)
  const defaultDatabaseUrl = process.env.DATABASE_URL || 
    'postgresql://postgres:password@localhost:5432/creata_mission?schema=public';

  const baseConfig: DatabaseConfig = {
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

/**
 * Prisma 클라이언트 싱글톤 관리
 */
class DatabaseManager {
  private static instance: DatabaseManager;
  private prisma: PrismaClient | null = null;
  private config: DatabaseConfig;

  private constructor() {
    this.config = getDatabaseConfig();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Prisma 클라이언트 초기화 및 연결
   */
  public async connect(): Promise<PrismaClient> {
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

      // 쿼리 로깅 이벤트 리스너
      if (this.config.logging) {
        this.prisma.$on('query', (e) => {
          logger.debug('Database Query', {
            query: e.query,
            params: e.params,
            duration: `${e.duration}ms`
          });
        });
      }

      // 데이터베이스 연결 테스트
      await this.prisma.$connect();
      logger.info('데이터베이스 연결 성공', {
        environment: process.env.NODE_ENV,
        maxConnections: this.config.maxConnections
      });

      return this.prisma;

    } catch (error) {
      logger.error('데이터베이스 연결 실패', { error });
      throw error;
    }
  }

  /**
   * 데이터베이스 연결 해제
   */
  public async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
      logger.info('데이터베이스 연결 해제');
    }
  }

  /**
   * 데이터베이스 상태 확인
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.prisma) {
        await this.connect();
      }
      
      await this.prisma!.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('데이터베이스 상태 확인 실패', { error });
      return false;
    }
  }

  /**
   * 현재 Prisma 클라이언트 반환
   */
  public getClient(): PrismaClient {
    if (!this.prisma) {
      throw new Error('데이터베이스가 초기화되지 않음. connect()를 먼저 호출하세요.');
    }
    return this.prisma;
  }
}

// 데이터베이스 매니저 싱글톤 인스턴스
export const databaseManager = DatabaseManager.getInstance();

// 설정 정보 내보내기
export const databaseConfig = getDatabaseConfig();

/**
 * 데이터베이스 초기화 함수
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await databaseManager.connect();
    logger.info('데이터베이스 초기화 완료');
  } catch (error) {
    logger.error('데이터베이스 초기화 실패', { error });
    throw error;
  }
}

/**
 * 데이터베이스 정리 함수
 */
export async function cleanupDatabase(): Promise<void> {
  try {
    await databaseManager.disconnect();
    logger.info('데이터베이스 정리 완료');
  } catch (error) {
    logger.error('데이터베이스 정리 실패', { error });
  }
}