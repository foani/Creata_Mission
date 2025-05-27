 
/**
 * Redis 기반 요청 제한 미들웨어 (Rate Limiter)
 * 
 * 기능:
 * - Redis 기반 영구 저장으로 서버 재시작 시에도 데이터 유지
 * - 멀티 프로세스/클러스터 환경에서 완벽한 동기화
 * - IP 기반 요청 빈도 제한
 * - API 엔드포인트별 차별화된 제한
 * - 게임 점수 제출 스팸 방지
 * - 관리자 API 보호
 * - DDoS 공격 완화
 * - Sliding Window 알고리즘 구현
 * 
 * 사용법:
 * - generalLimiter: 일반 API 제한
 * - strictLimiter: 엄격한 제한 (로그인, 민감한 API)
 * - gameLimiter: 게임 제출 전용 제한
 * - adminLimiter: 관리자 전용 제한
 */

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Redis 클라이언트 초기화
const createRedisClient = (): Redis => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  const redis = new Redis(redisUrl, {
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    // 하드코딩된 Redis 설정값들 (관리자 패널에서 조정 가능)
    connectTimeout: 10000,
    commandTimeout: 5000,
  });

  redis.on('connect', () => {
    logger.info('Redis Rate Limiter 연결 성공', { url: redisUrl });
  });

  redis.on('error', (err) => {
    logger.error('Redis Rate Limiter 연결 오류', { error: err.message });
  });

  return redis;
};

const redis = createRedisClient();

// Redis Lua 스크립트 - Sliding Window 알고리즘
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- 만료된 항목 제거
redis.call('ZREMRANGEBYSCORE', key, 0, now - window * 1000)

-- 현재 카운트 확인
local current = redis.call('ZCARD', key)

if current < limit then
    -- 요청 허용: 현재 타임스탬프를 점수로 사용하여 추가
    redis.call('ZADD', key, now, now)
    redis.call('EXPIRE', key, window + 1)
    return {1, limit - current - 1}
else
    -- 요청 거부
    return {0, 0}
end
`;

// Redis 차단 관리 스크립트
const BLOCK_MANAGEMENT_SCRIPT = `
local blockKey = KEYS[1]
local blockUntil = tonumber(ARGV[1])
local now = tonumber(ARGV[2])

-- 차단 상태 확인
local blockData = redis.call('GET', blockKey)
if blockData then
    local blockTime = tonumber(blockData)
    if blockTime > now then
        return {1, blockTime - now}
    else
        redis.call('DEL', blockKey)
    end
end

-- 새로운 차단 설정 (blockUntil이 0이 아닌 경우)
if blockUntil > 0 then
    redis.call('SET', blockKey, blockUntil)
    redis.call('EXPIRE', blockKey, math.ceil((blockUntil - now) / 1000))
end

return {0, 0}
`;

/**
 * 클라이언트 식별자 생성
 */
const getClientIdentifier = (req: Request, additionalKey?: string): string => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userId = (req as any).user?.id;
  
  // 사용자가 로그인한 경우 사용자 ID 포함
  const baseKey = userId ? `user:${userId}` : `ip:${ip}`;
  
  return additionalKey ? `rate_limit:${baseKey}:${additionalKey}` : `rate_limit:${baseKey}`;
};

/**
 * Redis 기반 Rate Limiter 팩토리 함수
 */
export const createRedisRateLimiter = (options: {
  windowMs: number;           // 시간 윈도우 (밀리초)
  maxRequests: number;        // 최대 요청 수
  message?: string;           // 제한 시 메시지
  keyGenerator?: (req: Request) => string;  // 커스텀 키 생성
  onLimitReached?: (req: Request) => void;  // 제한 도달 시 콜백
  blockDuration?: number;     // 차단 지속 시간 (밀리초)
  skipSuccessfulRequests?: boolean;  // 성공한 요청 제외
  skipFailedRequests?: boolean;      // 실패한 요청 제외
}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientKey = options.keyGenerator ? options.keyGenerator(req) : getClientIdentifier(req);
      const blockKey = `${clientKey}:blocked`;
      const now = Date.now();
      
      // 차단 상태 확인
      const blockResult = await redis.eval(
        BLOCK_MANAGEMENT_SCRIPT,
        1,
        blockKey,
        options.blockDuration && options.blockDuration > 0 ? (now + options.blockDuration).toString() : '0',
        now.toString()
      ) as [number, number];
      
      if (blockResult[0] === 1) {
        const remainingTime = Math.ceil(blockResult[1] / 1000);
        
        logger.warn('차단된 클라이언트 요청 시도', {
          client: clientKey,
          remainingTime,
          path: req.path
        });
        
        res.status(429).json({
          success: false,
          message: '일시적으로 차단되었습니다. 잠시 후 다시 시도해주세요.',
          code: 'CLIENT_BLOCKED',
          retryAfter: remainingTime
        });
        return;
      }
      
      // Sliding Window Rate Limiting
      const result = await redis.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        clientKey,
        Math.ceil(options.windowMs / 1000).toString(),
        options.maxRequests.toString(),
        now.toString()
      ) as [number, number];
      
      const [allowed, remaining] = result;
      
      // 응답 헤더에 Rate Limit 정보 추가
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + options.windowMs) / 1000));
      
      if (allowed === 0) {
        // 제한 도달 로깅
        logger.warn('Redis Rate Limit 초과', {
          client: clientKey,
          limit: options.maxRequests,
          window: options.windowMs,
          path: req.path,
          method: req.method,
          userAgent: req.headers['user-agent']
        });
        
        // 콜백 실행
        if (options.onLimitReached) {
          options.onLimitReached(req);
        }
        
        // 차단 설정 (옵션)
        if (options.blockDuration) {
          await redis.eval(
            BLOCK_MANAGEMENT_SCRIPT,
            1,
            blockKey,
            (now + options.blockDuration).toString(),
            now.toString()
          );
        }
        
        const retryAfter = Math.ceil(options.windowMs / 1000);
        res.setHeader('Retry-After', retryAfter);
        res.status(429).json({
          success: false,
          message: options.message || '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter
        });
        return;
      }
      
      // 응답 후 처리 (skipSuccessfulRequests, skipFailedRequests 로직)
      if (options.skipSuccessfulRequests || options.skipFailedRequests) {
        const originalSend = res.send;
        res.send = function(body) {
          const statusCode = res.statusCode;
          const shouldSkip = 
            (options.skipSuccessfulRequests && statusCode < 400) ||
            (options.skipFailedRequests && statusCode >= 400);
          
          if (shouldSkip) {
            // 요청 카운트에서 제외 (Redis에서 해당 항목 제거)
            redis.zrem(clientKey, now.toString()).catch(err => {
              logger.error('Rate Limit 카운트 롤백 실패', { error: err });
            });
          }
          
          return originalSend.call(this, body);
        };
      }
      
      next();
    } catch (error) {
      logger.error('Redis Rate Limiter 오류', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        client: req.ip
      });
      
      // Redis 오류 시 요청 허용 (페일오픈 방식)
      next();
    }
  };
};

/**
 * 메모리 기반 폴백 (Redis 연결 실패 시)
 */
const memoryStore = new Map<string, { count: number; resetTime: number }>();

const createMemoryFallbackLimiter = (options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientKey = getClientIdentifier(req);
    const now = Date.now();
    
    let record = memoryStore.get(clientKey);
    
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + options.windowMs
      };
      memoryStore.set(clientKey, record);
    }
    
    record.count++;
    
    if (record.count > options.maxRequests) {
      res.status(429).json({
        success: false,
        message: options.message || '요청이 너무 많습니다. (폴백 모드)',
        code: 'RATE_LIMIT_EXCEEDED'
      });
      return;
    }
    
    next();
  };
};

/**
 * Redis 상태 확인 및 폴백 처리
 */
const createResilientRateLimiter = (options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request) => void;
  blockDuration?: number;
}) => {
  const redisLimiter = createRedisRateLimiter(options);
  const memoryLimiter = createMemoryFallbackLimiter(options);
  
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Redis 연결 상태 확인
      if (redis.status === 'ready') {
        return await redisLimiter(req, res, next);
      } else {
        logger.warn('Redis 연결 불안정, 메모리 폴백 사용');
        return memoryLimiter(req, res, next);
      }
    } catch (error) {
      logger.error('Rate Limiter 오류, 메모리 폴백 사용', { error });
      return memoryLimiter(req, res, next);
    }
  };
};

/**
 * 일반 API용 Rate Limiter (분당 60요청)
 */
export const generalLimiter = createResilientRateLimiter({
  windowMs: 60 * 1000,  // 1분
  maxRequests: 60,
  message: '일반 API 요청 한도를 초과했습니다.'
});

/**
 * 엄격한 Rate Limiter (분당 10요청) - 로그인, 민감한 API용
 */
export const strictLimiter = createResilientRateLimiter({
  windowMs: 60 * 1000,  // 1분
  maxRequests: 10,
  message: '보안을 위해 요청이 제한되었습니다.',
  blockDuration: 5 * 60 * 1000,  // 5분 차단
  onLimitReached: (req) => {
    logger.error('엄격한 Rate Limit 위반', {
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
});

/**
 * 게임 제출용 Rate Limiter (분당 30요청)
 */
export const gameLimiter = createResilientRateLimiter({
  windowMs: 60 * 1000,  // 1분
  maxRequests: 30,
  keyGenerator: (req) => getClientIdentifier(req, 'game'),
  message: '게임 제출 요청이 너무 빠릅니다. 잠시 쉬었다가 다시 시도해주세요.'
});

/**
 * 시간당 게임 제출 제한
 */
export const gameHourlyLimiter = createResilientRateLimiter({
  windowMs: 60 * 60 * 1000,  // 1시간
  maxRequests: 100,
  keyGenerator: (req) => getClientIdentifier(req, 'game-hourly'),
  message: '시간당 게임 제출 한도를 초과했습니다.',
  blockDuration: 30 * 60 * 1000  // 30분 차단
});

/**
 * 관리자 API용 Rate Limiter (분당 100요청)
 */
export const adminLimiter = createResilientRateLimiter({
  windowMs: 60 * 1000,  // 1분
  maxRequests: 100,
  keyGenerator: (req) => getClientIdentifier(req, 'admin'),
  message: '관리자 API 요청 한도를 초과했습니다.',
  onLimitReached: (req) => {
    logger.warn('관리자 Rate Limit 위반', {
      admin: (req as any).user?.id,
      path: req.path,
      ip: req.ip
    });
  }
});

/**
 * 인증 API용 Rate Limiter (분당 5요청) - 브루트포스 공격 방지
 */
export const authLimiter = createResilientRateLimiter({
  windowMs: 60 * 1000,  // 1분
  maxRequests: 5,
  keyGenerator: (req) => getClientIdentifier(req, 'auth'),
  message: '인증 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
  blockDuration: 15 * 60 * 1000,  // 15분 차단
  onLimitReached: (req) => {
    logger.error('인증 Rate Limit 위반 - 잠재적 브루트포스 공격', {
      path: req.path,
      ip: req.ip,
      body: req.body?.walletAddress ? `${req.body.walletAddress.substring(0, 8)}...` : 'unknown'
    });
  }
});

/**
 * 에어드랍 요청용 Rate Limiter (시간당 3요청)
 */
export const airdropLimiter = createResilientRateLimiter({
  windowMs: 60 * 60 * 1000,  // 1시간
  maxRequests: 3,
  keyGenerator: (req) => getClientIdentifier(req, 'airdrop'),
  message: '에어드랍 요청은 시간당 3회로 제한됩니다.',
  blockDuration: 2 * 60 * 60 * 1000  // 2시간 차단
});

/**
 * IP 기반 글로벌 Rate Limiter (분당 200요청)
 */
export const globalLimiter = createResilientRateLimiter({
  windowMs: 60 * 1000,  // 1분
  maxRequests: 200,
  keyGenerator: (req) => `rate_limit:global:${req.ip}`,
  message: '전체 요청 한도를 초과했습니다.',
  onLimitReached: (req) => {
    logger.warn('글로벌 Rate Limit 위반', {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
});

/**
 * 텔레그램 미니앱용 Rate Limiter (분당 120요청)
 */
export const telegramLimiter = createResilientRateLimiter({
  windowMs: 60 * 1000,  // 1분
  maxRequests: 120,
  keyGenerator: (req) => getClientIdentifier(req, 'telegram'),
  message: '텔레그램 미니앱 요청 한도를 초과했습니다.'
});

/**
 * 현재 Rate Limit 상태 조회 (관리자용)
 */
export const getRateLimitStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = {
      redisConnected: redis.status === 'ready',
      redisStatus: redis.status,
      totalKeys: 0,
      rateLimitKeys: [] as string[]
    };
    
    if (redis.status === 'ready') {
      // Redis에서 Rate Limit 관련 키 조회
      const keys = await redis.keys('rate_limit:*');
      stats.totalKeys = keys.length;
      
      // 관리자만 상세 정보 제공
      if ((req as any).user?.isAdmin) {
        stats.rateLimitKeys = keys.slice(0, 100);  // 최대 100개만 표시
      }
    }
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Rate Limit 상태 조회 오류', { error });
    res.status(500).json({
      success: false,
      message: 'Rate Limit 상태 조회에 실패했습니다.'
    });
  }
};

/**
 * Rate Limit 초기화 (관리자용)
 */
export const resetRateLimit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientKey, pattern } = req.body;
    
    if (clientKey) {
      // 특정 클라이언트 제한 해제
      await redis.del(clientKey, `${clientKey}:blocked`);
      logger.info('특정 클라이언트 Rate Limit 초기화', { 
        clientKey, 
        admin: (req as any).user?.id 
      });
    } else if (pattern) {
      // 패턴 매칭으로 여러 키 삭제
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      logger.info('패턴 기반 Rate Limit 초기화', { 
        pattern, 
        deletedCount: keys.length,
        admin: (req as any).user?.id 
      });
    } else {
      // 전체 Rate Limit 초기화
      const keys = await redis.keys('rate_limit:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      logger.info('전체 Rate Limit 초기화', { 
        deletedCount: keys.length,
        admin: (req as any).user?.id 
      });
    }
    
    res.json({
      success: true,
      message: 'Rate Limit 초기화 완료'
    });
  } catch (error) {
    logger.error('Rate Limit 초기화 오류', { error });
    res.status(500).json({
      success: false,
      message: 'Rate Limit 초기화에 실패했습니다.'
    });
  }
};

/**
 * Redis 연결 종료 (앱 종료 시)
 */
export const closeRedisConnection = async (): Promise<void> => {
  try {
    await redis.quit();
    logger.info('Redis Rate Limiter 연결 종료');
  } catch (error) {
    logger.error('Redis Rate Limiter 연결 종료 오류', { error });
  }
};

export default {
  createRedisRateLimiter,
  createResilientRateLimiter,
  generalLimiter,
  strictLimiter,
  gameLimiter,
  gameHourlyLimiter,
  adminLimiter,
  authLimiter,
  airdropLimiter,
  globalLimiter,
  telegramLimiter,
  getRateLimitStatus,
  resetRateLimit,
  closeRedisConnection
};