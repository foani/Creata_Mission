// backend/src/server.ts
// CreataChain 기반 텔레그램 미션 게임 백엔드 서버
// Express + Prisma + JWT 인증 시스템 (TypeScript)

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Route imports (ES Module 방식 - .js 확장자 필수)
import authRouter from './routes/auth.js';
import gameRouter from './routes/game.js';
import rankingRouter from './routes/ranking.js';
import airdropRouter from './routes/airdrop.js';
import adminRouter from './routes/admin.js';

// 환경변수 로드
dotenv.config();

// Prisma 클라이언트 초기화
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Express 앱 초기화
const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10); // 하드코딩된 기본 포트 번호

/**
 * 기본 미들웨어 설정
 * - 보안, CORS, 로깅, JSON 파싱 등
 */
function setupBasicMiddleware() {
  // 보안 헤더 설정
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // CORS 설정 - 하드코딩된 허용 도메인 리스트
  const corsOptions = {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [
      'http://localhost:3001', // 하드코딩된 어드민 패널 도메인
      'http://localhost:5173', // 하드코딩된 프론트엔드 개발 서버
      'https://t.me' // 하드코딩된 텔레그램 도메인
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  app.use(cors(corsOptions));

  // 요청 로깅
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // JSON 파싱 설정
  app.use(express.json({ limit: '10mb' })); // 하드코딩된 요청 크기 제한
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 정적 파일 서빙 (로그 등)
  app.use('/logs', express.static(path.join(__dirname, '../logs')));
  }

/**
 * API 라우터 설정
 * - 지갑 인증, 게임, 랭킹, 에어드랍 등
 */
function setupRoutes() {
  // 기본 헬스 검사 API (Health Check)
  app.get('/health', async (req, res) => {
    try {
      // 데이터베이스 연결 상태 확인
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        database: 'connected'
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: '데이터베이스 연결 실패'
      });
    }
  });

  // API 라우터 사용 (하드코딩된 API 경로 접두사)
  app.use('/api/auth', authRouter);
  app.use('/api/game', gameRouter);
  app.use('/api/ranking', rankingRouter);
  app.use('/api/airdrop', airdropRouter);
  app.use('/api/admin', adminRouter);

  // 404 에러 처리 - 존재하지 않는 엔드포인트
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'ENDPOINT_NOT_FOUND',
      message: `요청한 API 엔드포인트를 찾을 수 없습니다: ${req.method} ${req.originalUrl}`,
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * 글로벌 에러 핸들링 미들웨어
 * - 매우 중요: 모든 예외 상황을 안전하게 처리
 */
function setupErrorHandling() {
  // 비동기 오류 처리
  process.on('uncaughtException', (error) => {
    console.error('⚠️  Uncaught Exception:', error);
    process.exit(1); // 위험한 상태이므로 서버 종료
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  // Express 에러 핸들링 미들웨어 (TypeScript 타입 명시)
  app.use((error: any, req: Request, res: Response, next: NextFunction) => {
    console.error('🔴 Express Error:', error);

    // Prisma 에러 처리
    if (error.code && error.code.startsWith('P')) {
      return res.status(400).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: '데이터베이스 오류가 발생했습니다.',
        code: error.code
      });
    }

    // JWT 에러 처리
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: '유효하지 않은 인증 토큰입니다.'
      });
    }

    // 기본 에러 응답
    res.status(error.status || 500).json({
      success: false,
      error: error.name || 'INTERNAL_SERVER_ERROR',
      message: error.message || '내부 서버 오류가 발생했습니다.',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  });
}

/**
 * 우아한 종료 처리 (Graceful Shutdown)
 * - 서버 종료 시 데이터베이스 연결 정리 등
 */
function setupGracefulShutdown() {
  const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 ${signal} 신호 수신, 서버를 원한 종료합니다...`);
    
    try {
      // Prisma 연결 종료
      await prisma.$disconnect();
      console.log('✅ 데이터베이스 연결을 종료했습니다.');
      
      // 기타 정리 작업이 있다면 여기에 추가
      
      console.log('🚀 서버가 안전하게 종료되었습니다.');
      process.exit(0);
    } catch (error) {
      console.error('❌ 서버 종료 중 오류 발생:', error);
      process.exit(1);
    }
  };

  // 종료 신호 리스너 등록
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

/**
 * 서버 시작 메인 함수
 * - 모든 설정을 순서대로 수행하고 서버 시작
 */
async function startServer() {
  try {
    console.log('🚀 CreataChain 미션 게임 백엔드 서버 시작...');
    
    // 1. 기본 미들웨어 설정
    setupBasicMiddleware();
    console.log('✅ 기본 미들웨어 설정 완료');
    
    // 2. 데이터베이스 연결 테스트
    await prisma.$connect();
    console.log('✅ PostgreSQL 데이터베이스 연결 성공');
    
    // 3. API 라우터 설정
    setupRoutes();
    console.log('✅ API 라우터 설정 완료');
    
    // 4. 에러 핸들링 설정
    setupErrorHandling();
    console.log('✅ 에러 핸들링 설정 완료');
    
    // 5. 원한 종료 설정
    setupGracefulShutdown();
    console.log('✅ 원한 종료 설정 완료');
    
    // 6. 서버 시작
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🎉 서버가 성공적으로 시작되었습니다!`);
      console.log(`\n📍 서버 정보:`);
      console.log(`   - 포트: ${PORT}`);
      console.log(`   - 환경: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   - 로컬 URL: http://localhost:${PORT}`);
      console.log(`   - 헬스 체크: http://localhost:${PORT}/health`);
      console.log(`\n🔍 API 엔드포인트:`);
      console.log(`   - POST /api/auth/verify-wallet - 지갑 인증`);
      console.log(`   - POST /api/game/submit - 게임 결과 제출`);
      console.log(`   - GET  /api/ranking - 랭킹 조회`);
      console.log(`   - POST /api/airdrop/execute - 에어드랍 실행`);
      console.log(`\n🚪 종료하려면 Ctrl+C 를 눌러주세요.\n`);
    });
    
    // 서버 인스턴스를 어플리케이션 전체에서 사용할 수 있도록 저장
    // TypeScript 타입 안전성을 위해 export 변수 사용
    // global.server = server; // 제거됨
    
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

// 서버 시작 - 이 파일이 직접 실행될 때만 작동 (ES Module 방식)
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  startServer();
}

// 모듈 익스포트 - 테스트나 다른 파일에서 사용 가능 (ES Module 방식)
export { app, prisma, startServer };