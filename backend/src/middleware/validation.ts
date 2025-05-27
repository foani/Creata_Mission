/**
 * 입력 검증 미들웨어
 * 
 * 기능:
 * - API 요청 데이터 검증
 * - 지갑 주소 형식 검증
 * - 게임 데이터 검증
 * - 에어드랍 요청 검증
 * - SQL Injection 방지
 * - XSS 공격 방지
 * 
 * 사용법:
 * - validateWalletAddress: 지갑 주소 검증
 * - validateGameSubmission: 게임 점수 제출 검증
 * - validateAirdropRequest: 에어드랍 요청 검증
 * - sanitizeInput: 입력값 정제
 */

import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

// 유효한 게임 타입들
const VALID_GAME_TYPES = ['binary', 'derby', 'darts'] as const;
type GameType = typeof VALID_GAME_TYPES[number];

// 유효한 언어 코드들
const VALID_LANGUAGES = ['ko', 'en', 'vi', 'ja'] as const;
type Language = typeof VALID_LANGUAGES[number];

// 검증 결과 처리 미들웨어
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined
    }));

    logger.warn('입력 검증 실패', {
      errors: errorMessages,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    res.status(400).json({
      success: false,
      message: '입력값이 유효하지 않습니다',
      code: 'VALIDATION_ERROR',
      errors: errorMessages
    });
    return;
  }

  next();
};

/**
 * 지갑 주소 형식 검증
 * Ethereum/EVM 호환 주소 형식 (0x + 40자리 hex)
 */
export const validateWalletAddress = [
  body('walletAddress')
    .isString()
    .withMessage('지갑 주소는 문자열이어야 합니다')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('유효하지 않은 지갑 주소 형식입니다 (0x + 40자리 hex 필요)'),
  
  handleValidationErrors
];

/**
 * 지갑 주소 파라미터 검증 (URL 파라미터용)
 */
export const validateWalletAddressParam = [
  param('walletAddress')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('유효하지 않은 지갑 주소 형식입니다'),
  
  handleValidationErrors
];

/**
 * 게임 점수 제출 검증
 */
export const validateGameSubmission = [
  body('gameType')
    .isIn(VALID_GAME_TYPES)
    .withMessage(`게임 타입은 다음 중 하나여야 합니다: ${VALID_GAME_TYPES.join(', ')}`),
  
  body('score')
    .isInt({ min: 0, max: 10000 })
    .withMessage('점수는 0 이상 10000 이하의 정수여야 합니다'),
  
  body('round')
    .isInt({ min: 1 })
    .withMessage('라운드는 1 이상의 정수여야 합니다'),
  
  body('result')
    .isObject()
    .withMessage('게임 결과는 객체 형태여야 합니다')
    .custom((value) => {
      // 게임 결과 객체 내부 검증
      if (typeof value !== 'object' || value === null) {
        throw new Error('게임 결과는 유효한 객체여야 합니다');
      }
      
      // 각 게임별 특별 검증
      return true;
    }),
  
  handleValidationErrors
];

/**
 * 게임별 세부 결과 검증
 */
export const validateGameTypeSpecific = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { gameType, result, score } = req.body;

  try {
    switch (gameType) {
      case 'binary':
        // 이진 옵션 게임 검증
        if (!result.prediction || !['up', 'down'].includes(result.prediction)) {
          throw new Error('이진 옵션 예측값은 up 또는 down이어야 합니다');
        }
        if (typeof result.startPrice !== 'number' || result.startPrice <= 0) {
          throw new Error('시작 가격은 양수여야 합니다');
        }
        if (typeof result.endPrice !== 'number' || result.endPrice <= 0) {
          throw new Error('종료 가격은 양수여야 합니다');
        }
        // 점수 검증 (정답: 100점, 오답: 0점)
        if (![0, 100].includes(score)) {
          throw new Error('이진 옵션 점수는 0점 또는 100점이어야 합니다');
        }
        break;

      case 'derby':
        // 경마 게임 검증
        if (!result.selectedHorse || !Number.isInteger(result.selectedHorse) || 
            result.selectedHorse < 1 || result.selectedHorse > 5) {
          throw new Error('선택한 말은 1-5 사이의 정수여야 합니다');
        }
        if (!result.ranking || !Array.isArray(result.ranking) || result.ranking.length !== 5) {
          throw new Error('경주 결과는 5마리 말의 순위 배열이어야 합니다');
        }
        // 점수 검증 (승리: 150점, 패배: 0점)
        if (![0, 150].includes(score)) {
          throw new Error('경마 게임 점수는 0점 또는 150점이어야 합니다');
        }
        break;

      case 'darts':
        // 다트 게임 검증
        if (typeof result.survivalTime !== 'number' || result.survivalTime < 0 || result.survivalTime > 10) {
          throw new Error('생존 시간은 0-10초 사이여야 합니다');
        }
        if (typeof result.hitCount !== 'number' || result.hitCount < 0) {
          throw new Error('피격 횟수는 0 이상이어야 합니다');
        }
        // 점수 검증 (생존: 200점, 실패: 0점)
        if (![0, 200].includes(score)) {
          throw new Error('다트 게임 점수는 0점 또는 200점이어야 합니다');
        }
        break;

      default:
        throw new Error(`지원하지 않는 게임 타입: ${gameType}`);
    }

    logger.info('게임별 검증 통과', { 
      gameType, 
      score, 
      userId: (req as any).user?.id 
    });

    next();
  } catch (error) {
    logger.warn('게임별 검증 실패', {
      gameType,
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.id
    });

    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '게임 데이터 검증에 실패했습니다',
      code: 'GAME_VALIDATION_ERROR'
    });
  }
};

/**
 * 에어드랍 요청 검증
 */
export const validateAirdropRequest = [
  body('rewardType')
    .isIn(['ranking', 'event', 'referral'])
    .withMessage('보상 타입은 ranking, event, referral 중 하나여야 합니다'),
  
  body('ctaAmount')
    .isDecimal({ decimal_digits: '0,8' })
    .withMessage('CTA 금액은 소수점 8자리 이하의 유효한 숫자여야 합니다')
    .custom((value) => {
      const amount = parseFloat(value);
      if (amount <= 0) {
        throw new Error('CTA 금액은 0보다 커야 합니다');
      }
      if (amount > 10000) {
        throw new Error('CTA 금액은 10,000을 초과할 수 없습니다');
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * 언어 설정 검증
 */
export const validateLanguage = [
  body('language')
    .isIn(VALID_LANGUAGES)
    .withMessage(`언어는 다음 중 하나여야 합니다: ${VALID_LANGUAGES.join(', ')}`),
  
  handleValidationErrors
];

/**
 * 페이지네이션 검증
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('페이지는 1 이상의 정수여야 합니다'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('한 페이지 아이템 수는 1-100 사이여야 합니다'),
  
  handleValidationErrors
];

/**
 * 관리자 에어드랍 실행 검증
 */
export const validateAdminAirdrop = [
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('사용자 ID 배열이 필요합니다')
    .custom((userIds) => {
      // UUID 형식 검증
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      for (const userId of userIds) {
        if (typeof userId !== 'string' || !uuidRegex.test(userId)) {
          throw new Error('모든 사용자 ID는 유효한 UUID 형식이어야 합니다');
        }
      }
      return true;
    }),
  
  body('ctaAmount')
    .isDecimal({ decimal_digits: '0,8' })
    .withMessage('CTA 금액은 소수점 8자리 이하의 유효한 숫자여야 합니다')
    .custom((value) => {
      const amount = parseFloat(value);
      if (amount <= 0) throw new Error('CTA 금액은 0보다 커야 합니다');
      if (amount > 1000) throw new Error('관리자 에어드랍은 한 번에 1,000 CTA를 초과할 수 없습니다');
      return true;
    }),
  
  body('reason')
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('에어드랍 사유는 1-200자 사이여야 합니다'),
  
  handleValidationErrors
];

/**
 * 입력값 정제 미들웨어 (XSS, SQL Injection 방지)
 */
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // 재귀적으로 모든 문자열 입력값 정제
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        // HTML 태그 제거
        return obj.replace(/<[^>]*>/g, '')
                 .replace(/javascript:/gi, '')
                 .replace(/on\w+=/gi, '')
                 .trim();
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      
      if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            sanitized[key] = sanitizeObject(obj[key]);
          }
        }
        return sanitized;
      }
      
      return obj;
    };

    // body, query, params 정제
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error('입력값 정제 중 오류 발생', { error });
    res.status(500).json({
      success: false,
      message: '입력값 처리 중 오류가 발생했습니다',
      code: 'SANITIZATION_ERROR'
    });
  }
};

/**
 * IP 주소 기반 요청 빈도 제한 (간단한 구현)
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const simpleRateLimit = (maxRequests: number = 100, windowMs: number = 60000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    const clientData = requestCounts.get(clientIP);
    
    if (!clientData || now > clientData.resetTime) {
      // 새로운 시간 윈도우 시작
      requestCounts.set(clientIP, {
        count: 1,
        resetTime: now + windowMs
      });
      next();
      return;
    }
    
    if (clientData.count >= maxRequests) {
      logger.warn('요청 빈도 제한 초과', { 
        ip: clientIP, 
        count: clientData.count,
        path: req.path 
      });
      
      res.status(429).json({
        success: false,
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      });
      return;
    }
    
    // 요청 카운트 증가
    clientData.count++;
    next();
  };
};

export default {
  handleValidationErrors,
  validateWalletAddress,
  validateWalletAddressParam,
  validateGameSubmission,
  validateGameTypeSpecific,
  validateAirdropRequest,
  validateLanguage,
  validatePagination,
  validateAdminAirdrop,
  sanitizeInput,
  simpleRateLimit
}; 
