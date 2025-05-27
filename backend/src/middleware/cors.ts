 /**
 * CORS 설정 미들웨어
 * 
 * 기능:
 * - Cross-Origin Resource Sharing 설정
 * - 텔레그램 미니앱 도메인 허용
 * - 개발/프로덕션 환경별 설정
 * - 프리플라이트 요청 처리
 * - 보안 헤더 설정
 * 
 * 사용법:
 * - corsConfig: 기본 CORS 설정
 * - telegramCors: 텔레그램 전용 CORS
 * - adminCors: 관리자 패널 전용 CORS
 * - apiCors: API 전용 CORS
 */
 
 import { Request, Response, NextFunction } from 'express';
 import cors from 'cors';
 import { logger } from '../utils/logger';
 
 // 환경별 허용 도메인 설정
const getAllowedOrigins = (): string[] => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  const origins: string[] = [];

  if (isDevelopment) {
    // 하드코딩된 개발 환경 도메인들
    const devOrigins = [
      'http://localhost:3000',  // React 개발 서버
      'http://localhost:3001',  // Admin 패널
      'http://localhost:5173',  // Vite 개발 서버
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173'
    ];
    origins.push(...devOrigins);
  }

  if (isProduction) {
    // 하드코딩된 프로덕션 환경 도메인들
    const prodOrigins = [
      process.env.FRONTEND_URL || 'https://creata-mission.vercel.app',     // 메인 프론트엔드
      process.env.ADMIN_URL || 'https://admin.creata-mission.com',         // 관리자 패널
      process.env.BACKUP_URL || 'https://creata-mission.netlify.app'       // 백업 도메인
    ];
    origins.push(...prodOrigins);
  }

  // 하드코딩된 텔레그램 미니앱 도메인들 (항상 허용)
  const telegramOrigins = [
    'https://web.telegram.org',
    'https://k.telegram.org',
    'https://z.telegram.org',
    'https://webk.telegram.org',
    'https://webz.telegram.org'
  ];
  origins.push(...telegramOrigins);
    

  // 환경변수에서 추가 허용 도메인 로드
  const customOrigins = process.env.ALLOWED_ORIGINS;
  if (customOrigins) {
    const additionalOrigins = customOrigins.split(',').map(origin => origin.trim());
    origins.push(...additionalOrigins);
  }

  logger.info('CORS 허용 도메인 설정', { 
    environment: process.env.NODE_ENV,
    originsCount: origins.length,
    origins: isDevelopment ? origins : '[보안상 숨김]'
  });

  return origins;
};

// 동적 Origin 검증 함수
const corsOriginCheck = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  const allowedOrigins = getAllowedOrigins();
  
  // Origin이 없는 경우 (같은 도메인 요청, 모바일 앱 등)
  if (!origin) {
    logger.debug('CORS: Origin 헤더 없음 - 허용');
    return callback(null, true);
  }

  // 허용된 도메인 목록에 있는지 확인
  if (allowedOrigins.includes(origin)) {
    logger.debug('CORS: 허용된 도메인', { origin });
    return callback(null, true);
  }

  // 개발 환경에서는 localhost 패턴 허용
  if (process.env.NODE_ENV === 'development' && 
      (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:'))) {
    logger.debug('CORS: 개발환경 localhost 허용', { origin });
    return callback(null, true);
  }

  logger.warn('CORS: 허용되지 않은 도메인 차단', { 
    origin,
    allowedOrigins: process.env.NODE_ENV === 'development' ? allowedOrigins : '[보안상 숨김]'
  });
  
  callback(new Error(`CORS 정책에 의해 차단된 도메인: ${origin}`), false);
};

/**
 * 기본 CORS 설정
 */
export const corsConfig = cors({
  origin: corsOriginCheck,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'User-Agent',
    'X-New-Token'  // 토큰 새로고침용 헤더
  ],
  exposedHeaders: [
    'X-New-Token',  // 클라이언트에서 접근 가능한 헤더
    'X-Total-Count',
    'X-Page-Count'
  ],
  credentials: true,  // 쿠키 및 인증 정보 포함 허용
  maxAge: 86400,      // 프리플라이트 캐시 시간 (24시간)
  optionsSuccessStatus: 200  // IE11 호환성
});

/**
 * 텔레그램 미니앱 전용 CORS 설정
 */
export const telegramCors = cors({
  origin: (origin, callback) => {
    // 텔레그램 도메인은 항상 허용
    const telegramOrigins = [
      'https://web.telegram.org',
      'https://k.telegram.org',
      'https://z.telegram.org',
      'https://webk.telegram.org',
      'https://webz.telegram.org'
    ];

    if (!origin || telegramOrigins.some(allowed => origin.includes('telegram.org'))) {
      logger.debug('텔레그램 CORS 허용', { origin });
      callback(null, true);
    } else {
      corsOriginCheck(origin, callback);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Telegram-Web-App-Data',  // 텔레그램 특별 헤더
    'Telegram-Web-App-Query-Id'
  ],
  credentials: true,
  maxAge: 86400
});

/**
 * 관리자 패널 전용 CORS 설정 (더 엄격)
 */
export const adminCors = cors({
  origin: (origin, callback) => {
    const adminOrigins = [
      process.env.ADMIN_URL || 'https://admin.creata-mission.com',  // 하드코딩된 관리자 도메인
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3001'] : [])
    ];

    if (!origin) {
      return callback(null, true);
    }

    if (adminOrigins.includes(origin)) {
      logger.debug('관리자 CORS 허용', { origin });
      callback(null, true);
    } else {
      logger.warn('관리자 CORS 차단', { origin });
      callback(new Error(`관리자 패널 접근 차단: ${origin}`), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],  // OPTIONS 제한적 허용
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With'
  ],
  credentials: true,
  maxAge: 3600  // 1시간 (더 짧은 캐시)
});

/**
 * API 전용 CORS 설정
 */
export const apiCors = cors({
  origin: corsOriginCheck,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Requested-With'
  ],
  credentials: false,  // API는 쿠키 불필요
  maxAge: 86400
});

/**
 * 프리플라이트 요청 최적화 미들웨어
 */
export const optimizedPreflight = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'OPTIONS') {
    // 프리플라이트 요청 로깅
    logger.debug('CORS 프리플라이트 요청', {
      origin: req.headers.origin,
      method: req.headers['access-control-request-method'],
      headers: req.headers['access-control-request-headers']
    });

    // 빠른 응답으로 성능 최적화
    res.status(204).end();
    return;
  }
  
  next();
};

/**
 * 보안 헤더 추가 미들웨어
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // 기본 보안 헤더들
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (개발환경에서는 완화)
  const isDevelopment = process.env.NODE_ENV === 'development';
  const csp = isDevelopment 
    ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' *; connect-src 'self' *;"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://cvm.node.creatachain.com;";
  
  res.setHeader('Content-Security-Policy', csp);

  // HSTS (HTTPS 강제) - 프로덕션에서만
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

/**
 * CORS 에러 처리 미들웨어
 */
export const corsErrorHandler = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  if (error.message.includes('CORS')) {
    logger.warn('CORS 에러 발생', {
      error: error.message,
      origin: req.headers.origin,
      method: req.method,
      path: req.path,
      ip: req.ip
    });

    res.status(403).json({
      success: false,
      message: 'CORS 정책에 의해 요청이 차단되었습니다',
      code: 'CORS_ERROR'
    });
    return;
  }
  
  next(error);
};

/**
 * 개발환경 전용 - 모든 도메인 허용 (주의: 프로덕션에서 사용 금지)
 */
export const developmentCors = cors({
  origin: true,  // 모든 도메인 허용
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: '*',
  credentials: true,
  maxAge: 86400
});

// 환경에 따른 CORS 설정 자동 선택
export const getEnvironmentCors = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const allowAllOrigins = process.env.CORS_ALLOW_ALL === 'true';

  if (isDevelopment && allowAllOrigins) {
    logger.warn('⚠️  개발환경에서 모든 도메인 CORS 허용 - 프로덕션에서 사용 금지!');
    return developmentCors;
  }

  return corsConfig;
};

export default {
  corsConfig,
  telegramCors,
  adminCors,
  apiCors,
  optimizedPreflight,
  securityHeaders,
  corsErrorHandler,
  developmentCors,
  getEnvironmentCors
};
