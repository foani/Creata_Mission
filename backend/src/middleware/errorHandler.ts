/**
 * 에러 핸들링 미들웨어
 * 
 * 기능:
 * - 전역 에러 처리 및 표준화된 응답
 * - Prisma 데이터베이스 에러 처리
 * - JWT 토큰 관련 에러 처리
 * - 입력 검증 에러 처리
 * - Web3/블록체인 에러 처리
 * - 운영 환경에서 민감한 정보 숨김
 * - 상세한 에러 로깅 및 모니터링
 * - 다국어 에러 메시지 지원
 * 
 * 사용법:
 * - errorHandler: 전역 에러 핸들러 (마지막에 사용)
 * - notFoundHandler: 404 에러 핸들러
 * - asyncHandler: async 함수 에러 래핑
 * - databaseErrorHandler: DB 에러 전용 핸들러
 */

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import { ValidationError } from 'express-validator';
import { logger } from '../utils/logger';

// 에러 타입 정의
interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

// 다국어 에러 메시지
const ERROR_MESSAGES = {
  ko: {
    INTERNAL_ERROR: '서버 내부 오류가 발생했습니다',
    NOT_FOUND: '요청한 리소스를 찾을 수 없습니다',
    UNAUTHORIZED: '인증이 필요합니다',
    FORBIDDEN: '접근 권한이 없습니다',
    VALIDATION_ERROR: '입력값이 유효하지 않습니다',
    TOKEN_EXPIRED: '토큰이 만료되었습니다',
    INVALID_TOKEN: '유효하지 않은 토큰입니다',
    DATABASE_ERROR: '데이터베이스 오류가 발생했습니다',
    NETWORK_ERROR: '네트워크 오류가 발생했습니다',
    BLOCKCHAIN_ERROR: '블록체인 연결 오류가 발생했습니다'
  },
  en: {
    INTERNAL_ERROR: 'Internal server error occurred',
    NOT_FOUND: 'Requested resource not found',
    UNAUTHORIZED: 'Authentication required',
    FORBIDDEN: 'Access denied',
    VALIDATION_ERROR: 'Invalid input data',
    TOKEN_EXPIRED: 'Token has expired',
    INVALID_TOKEN: 'Invalid token',
    DATABASE_ERROR: 'Database error occurred',
    NETWORK_ERROR: 'Network error occurred',
    BLOCKCHAIN_ERROR: 'Blockchain connection error'
  },
  vi: {
    INTERNAL_ERROR: 'Đã xảy ra lỗi máy chủ nội bộ',
    NOT_FOUND: 'Không tìm thấy tài nguyên được yêu cầu',
    UNAUTHORIZED: 'Yêu cầu xác thực',
    FORBIDDEN: 'Không có quyền truy cập',
    VALIDATION_ERROR: 'Dữ liệu đầu vào không hợp lệ',
    TOKEN_EXPIRED: 'Token đã hết hạn',
    INVALID_TOKEN: 'Token không hợp lệ',
    DATABASE_ERROR: 'Đã xảy ra lỗi cơ sở dữ liệu',
    NETWORK_ERROR: 'Đã xảy ra lỗi mạng',
    BLOCKCHAIN_ERROR: 'Lỗi kết nối blockchain'
  },
  ja: {
    INTERNAL_ERROR: 'サーバー内部エラーが発生しました',
    NOT_FOUND: '要求されたリソースが見つかりません',
    UNAUTHORIZED: '認証が必要です',
    FORBIDDEN: 'アクセス権限がありません',
    VALIDATION_ERROR: '入力データが無効です',
    TOKEN_EXPIRED: 'トークンの有効期限が切れています',
    INVALID_TOKEN: '無効なトークンです',
    DATABASE_ERROR: 'データベースエラーが発生しました',
    NETWORK_ERROR: 'ネットワークエラーが発生しました',
    BLOCKCHAIN_ERROR: 'ブロックチェーン接続エラーが発生しました'
  }
};

/**
 * 사용자 언어 감지
 */
const getUserLanguage = (req: Request): keyof typeof ERROR_MESSAGES => {
  const userLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0];
  const supportedLangs: (keyof typeof ERROR_MESSAGES)[] = ['ko', 'en', 'vi', 'ja'];
  
  return supportedLangs.includes(userLang as any) ? userLang as keyof typeof ERROR_MESSAGES : 'en';
};

/**
 * 에러 메시지 번역
 */
const translateError = (code: string, language: keyof typeof ERROR_MESSAGES): string => {
  return ERROR_MESSAGES[language][code as keyof typeof ERROR_MESSAGES[typeof language]] || 
         ERROR_MESSAGES.en[code as keyof typeof ERROR_MESSAGES['en']] || 
         'An error occurred';
};

/**
 * Prisma 에러 처리
 */
const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  code: string;
  message: string;
  details?: any;
} => {
  switch (error.code) {
    case 'P2002':
      // 고유 제약 조건 위반
      return {
        statusCode: 409,
        code: 'DUPLICATE_ENTRY',
        message: '이미 존재하는 데이터입니다',
        details: error.meta
      };
    
    case 'P2025':
      // 레코드를 찾을 수 없음
      return {
        statusCode: 404,
        code: 'RECORD_NOT_FOUND',
        message: '요청한 데이터를 찾을 수 없습니다'
      };
    
    case 'P2003':
      // 외래 키 제약 조건 위반
      return {
        statusCode: 400,
        code: 'FOREIGN_KEY_CONSTRAINT',
        message: '관련된 데이터가 존재하지 않습니다',
        details: error.meta
      };
    
    case 'P2014':
      // 관계된 레코드가 필요함
      return {
        statusCode: 400,
        code: 'REQUIRED_RELATION_MISSING',
        message: '필수 관련 데이터가 누락되었습니다'
      };
    
    case 'P2021':
      // 테이블이 존재하지 않음
      return {
        statusCode: 500,
        code: 'TABLE_NOT_EXISTS',
        message: '데이터베이스 구조 오류입니다'
      };
    
    case 'P2024':
      // 연결 시간 초과
      return {
        statusCode: 503,
        code: 'DATABASE_TIMEOUT',
        message: '데이터베이스 연결 시간이 초과되었습니다'
      };
    
    default:
      return {
        statusCode: 500,
        code: 'DATABASE_ERROR',
        message: '데이터베이스 오류가 발생했습니다'
      };
  }
};

/**
 * JWT 에러 처리
 */
const handleJWTError = (error: JsonWebTokenError | TokenExpiredError | NotBeforeError): {
  statusCode: number;
  code: string;
  message: string;
} => {
  if (error instanceof TokenExpiredError) {
    return {
      statusCode: 401,
      code: 'TOKEN_EXPIRED',
      message: '토큰이 만료되었습니다. 다시 로그인해주세요.'
    };
  }
  
  if (error instanceof NotBeforeError) {
    return {
      statusCode: 401,
      code: 'TOKEN_NOT_ACTIVE',
      message: '토큰이 아직 활성화되지 않았습니다.'
    };
  }
  
  return {
    statusCode: 401,
    code: 'INVALID_TOKEN',
    message: '유효하지 않은 토큰입니다.'
  };
};

/**
 * 블록체인/Web3 에러 처리
 */
const handleWeb3Error = (error: any): {
  statusCode: number;
  code: string;
  message: string;
} => {
  const errorMessage = error.message?.toLowerCase() || '';
  
  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return {
      statusCode: 503,
      code: 'BLOCKCHAIN_NETWORK_ERROR',
      message: '블록체인 네트워크 연결에 실패했습니다'
    };
  }
  
  if (errorMessage.includes('gas') || errorMessage.includes('fee')) {
    return {
      statusCode: 400,
      code: 'INSUFFICIENT_GAS',
      message: 'Gas fee가 부족합니다'
    };
  }
  
  if (errorMessage.includes('nonce')) {
    return {
      statusCode: 400,
      code: 'INVALID_NONCE',
      message: '트랜잭션 순서가 올바르지 않습니다'
    };
  }
  
  if (errorMessage.includes('revert')) {
    return {
      statusCode: 400,
      code: 'TRANSACTION_REVERTED',
      message: '스마트 컨트랙트 실행이 거부되었습니다'
    };
  }
  
  return {
    statusCode: 500,
    code: 'BLOCKCHAIN_ERROR',
    message: '블록체인 처리 중 오류가 발생했습니다'
  };
};

/**
 * 비동기 함수 에러 래핑 헬퍼
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found 핸들러
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const language = getUserLanguage(req);
  const message = translateError('NOT_FOUND', language);
  
  logger.warn('404 에러 발생', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  res.status(404).json({
    success: false,
    message,
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

/**
 * 데이터베이스 전용 에러 핸들러
 */
export const databaseErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const { statusCode, code, message, details } = handlePrismaError(error);
    const language = getUserLanguage(req);
    const translatedMessage = translateError(code, language);
    
    logger.error('Prisma 에러', {
      code: error.code,
      message: error.message,
      meta: error.meta,
      path: req.path,
      method: req.method,
      userId: (req as any).user?.id
    });
    
    res.status(statusCode).json({
      success: false,
      message: translatedMessage || message,
      code,
      ...(process.env.NODE_ENV === 'development' && { details })
    });
    return;
  }
  
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    logger.error('알 수 없는 Prisma 에러', {
      message: error.message,
      path: req.path,
      method: req.method
    });
    
    const language = getUserLanguage(req);
    const message = translateError('DATABASE_ERROR', language);
    
    res.status(500).json({
      success: false,
      message,
      code: 'DATABASE_ERROR'
    });
    return;
  }
  
  next(error);
};

/**
 * 전역 에러 핸들러 (맨 마지막에 사용)
 */
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const language = getUserLanguage(req);
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = translateError(code, language);
  let details: any = undefined;
  
  // 이미 응답이 전송된 경우 중단
  if (res.headersSent) {
    return next(error);
  }
  
  // 다양한 에러 타입별 처리
  if (error instanceof JsonWebTokenError || 
      error instanceof TokenExpiredError || 
      error instanceof NotBeforeError) {
    const jwtError = handleJWTError(error);
    statusCode = jwtError.statusCode;
    code = jwtError.code;
    message = translateError(code, language) || jwtError.message;
  }
  else if (error instanceof Prisma.PrismaClientKnownRequestError ||
           error instanceof Prisma.PrismaClientUnknownRequestError) {
    // 데이터베이스 에러는 별도 핸들러에서 처리되어야 함
    return databaseErrorHandler(error, req, res, next);
  }
  else if (error.name === 'Web3Error' || error.name === 'ContractError') {
    const web3Error = handleWeb3Error(error);
    statusCode = web3Error.statusCode;
    code = web3Error.code;
    message = translateError(code, language) || web3Error.message;
  }
  else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = translateError(code, language);
    details = error.details;
  }
  else if (error.statusCode || error.status) {
    // 커스텀 에러 객체
    statusCode = error.statusCode || error.status;
    code = error.code || 'CUSTOM_ERROR';
    message = error.message || translateError('INTERNAL_ERROR', language);
    details = error.details;
  }
  else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    statusCode = 503;
    code = 'NETWORK_ERROR';
    message = translateError(code, language);
  }
  else if (error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') {
    statusCode = 408;
    code = 'REQUEST_TIMEOUT';
    message = '요청 시간이 초과되었습니다';
  }
  
  // 에러 로깅
  const errorLog = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    },
    request: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.id
    },
    response: {
      statusCode,
      code
    },
    timestamp: new Date().toISOString()
  };
  
  if (statusCode >= 500) {
    logger.error('서버 에러 발생', errorLog);
  } else {
    logger.warn('클라이언트 에러 발생', errorLog);
  }
  
  // 개발 환경에서만 스택 트레이스 포함
  const response: any = {
    success: false,
    message,
    code,
    timestamp: new Date().toISOString()
  };
  
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
    response.details = details;
  }
  
  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details;
  }
  
  res.status(statusCode).json(response);
};

/**
 * 운영 환경 전용 에러 핸들러 (민감한 정보 완전 숨김)
 */
export const productionErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const language = getUserLanguage(req);
  
  // 모든 서버 에러는 일반적인 메시지로 대체
  const statusCode = error.statusCode || error.status || 500;
  const isServerError = statusCode >= 500;
  
  const response = {
    success: false,
    message: isServerError ? 
      translateError('INTERNAL_ERROR', language) : 
      error.message || translateError('INTERNAL_ERROR', language),
    code: isServerError ? 'INTERNAL_ERROR' : (error.code || 'ERROR'),
    timestamp: new Date().toISOString()
  };
  
  // 로깅은 여전히 상세하게
  logger.error('운영 환경 에러', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    request: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: (req as any).user?.id
    }
  });
  
  res.status(statusCode).json(response);
};

/**
 * 환경에 따른 에러 핸들러 선택
 */
export const getEnvironmentErrorHandler = () => {
  return process.env.NODE_ENV === 'production' ? 
    productionErrorHandler : 
    errorHandler;
};

/**
 * 에러 생성 헬퍼 함수들
 */
export const createError = (
  statusCode: number, 
  message: string, 
  code?: string, 
  details?: any
): CustomError => {
  const error = new Error(message) as CustomError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  error.isOperational = true;
  return error;
};

export const createValidationError = (message: string, details?: any): CustomError => {
  return createError(400, message, 'VALIDATION_ERROR', details);
};

export const createAuthError = (message: string = '인증이 필요합니다'): CustomError => {
  return createError(401, message, 'UNAUTHORIZED');
};

export const createForbiddenError = (message: string = '접근 권한이 없습니다'): CustomError => {
  return createError(403, message, 'FORBIDDEN');
};

export const createNotFoundError = (message: string = '리소스를 찾을 수 없습니다'): CustomError => {
  return createError(404, message, 'NOT_FOUND');
};

export default {
  errorHandler,
  productionErrorHandler,
  getEnvironmentErrorHandler,
  notFoundHandler,
  databaseErrorHandler,
  asyncHandler,
  createError,
  createValidationError,
  createAuthError,
  createForbiddenError,
  createNotFoundError
};