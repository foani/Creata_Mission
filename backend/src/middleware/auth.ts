/**
  * JWT 인증 미들웨어
  * 
  * 기능:
  * - JWT 토큰 검증
  * - 사용자 인증 상태 확인
  * - 관리자 권한 검증
  * - 요청 헤더에서 토큰 추출
  * 
  * 사용법:
  * - authenticateToken: 일반 사용자 인증
  * - authenticateAdmin: 관리자 인증
  * - optionalAuth: 선택적 인증 (토큰이 있으면 검증, 없어도 통과)
  */
 
 import { Request, Response, NextFunction } from 'express';
 import * as jwt from 'jsonwebtoken';
 import { PrismaClient } from '@prisma/client';
 import { logger } from '../utils/logger';
 
 const prisma = new PrismaClient();
 
 // JWT 페이로드 인터페이스
 interface JWTPayload {
   userId: string;
   walletAddress: string;
   isAdmin?: boolean;
   iat?: number;
   exp?: number;
 }
 
 // 확장된 Request 인터페이스
 export interface AuthenticatedRequest extends Request {
   user?: {
     id: string;
     walletAddress: string;
     isAdmin: boolean;
   };
 }
 
 /**
  * JWT 토큰에서 사용자 정보 추출 및 검증
  */
 const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
   if (!authHeader) {
     return null;
   }
 
   // Bearer 토큰 형식 확인
   if (authHeader.startsWith('Bearer ')) {
     return authHeader.substring(7);
   }
 
   // 직접 토큰만 전달된 경우
   return authHeader;
 };
 
 /**
  * JWT 토큰 검증 및 사용자 정보 반환
  */
 const verifyToken = async (token: string): Promise<JWTPayload | null> => {
   try {
     const jwtSecret = process.env.JWT_SECRET;
     if (!jwtSecret) {
       logger.error('JWT_SECRET 환경변수가 설정되지 않았습니다');
       return null;
     }
 
     const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
     
     // 토큰 유효성 기본 검증
     if (!decoded.userId || !decoded.walletAddress) {
       logger.warn('JWT 토큰에 필수 정보가 누락되었습니다', { decoded });
       return null;
     }
 
     // 데이터베이스에서 사용자 존재 여부 확인
     const user = await prisma.user.findUnique({
       where: { id: decoded.userId }
     });
 
     if (!user) {
       logger.warn('JWT 토큰의 사용자가 데이터베이스에 존재하지 않습니다', { 
         userId: decoded.userId 
       });
       return null;
     }
 
     // 지갑 주소 일치 확인
     if (user.walletAddress.toLowerCase() !== decoded.walletAddress.toLowerCase()) {
       logger.warn('JWT 토큰의 지갑 주소가 일치하지 않습니다', {
         tokenAddress: decoded.walletAddress,
         dbAddress: user.walletAddress
       });
       return null;
       }
     
 
     return decoded;
   } catch (error) {
     if (error instanceof jwt.TokenExpiredError) {
       logger.warn('JWT 토큰이 만료되었습니다');
     } else if (error instanceof jwt.JsonWebTokenError) {
       logger.warn('유효하지 않은 JWT 토큰입니다', { error: error.message });
     } else {
       logger.error('JWT 토큰 검증 중 오류 발생', { error });
     }
     return null;
   }
 };
 
 /**
  * 일반 사용자 인증 미들웨어
  * 유효한 JWT 토큰이 필요함
  */
 export const authenticateToken = async (
   req: AuthenticatedRequest,
   res: Response,
   next: NextFunction
 ): Promise<void> => {
   try {
     const token = extractTokenFromHeader(req.headers.authorization);
     
     if (!token) {
       res.status(401).json({
         success: false,
         message: 'Access token이 필요합니다',
         code: 'TOKEN_REQUIRED'
       });
       return;
     }
 
     const payload = await verifyToken(token);
     
     if (!payload) {
       res.status(401).json({
         success: false,
         message: '유효하지 않은 토큰입니다',
         code: 'INVALID_TOKEN'
       });
       return;
     }
 
     // 사용자 정보를 request 객체에 첨부
     req.user = {
       id: payload.userId,
       walletAddress: payload.walletAddress,
       isAdmin: payload.isAdmin || false
     };
 
     logger.info('사용자 인증 성공', { 
       userId: req.user.id,
       walletAddress: req.user.walletAddress.substring(0, 8) + '...'
     });
 
     next();
   } catch (error) {
     logger.error('인증 미들웨어에서 오류 발생', { error });
     res.status(500).json({
       success: false,
       message: '서버 내부 오류가 발생했습니다',
       code: 'INTERNAL_ERROR'
     });
   }
 };
 
 /**
  * 관리자 인증 미들웨어
  * 유효한 JWT 토큰 + 관리자 권한이 필요함
  */
 export const authenticateAdmin = async (
   req: AuthenticatedRequest,
   res: Response,
   next: NextFunction
 ): Promise<void> => {
   try {
     // 먼저 일반 사용자 인증 수행
     await new Promise<void>((resolve, reject) => {
       authenticateToken(req, res, (err) => {
         if (err) reject(err);
         else resolve();
       });
     });
 
     // 응답이 이미 전송된 경우 (인증 실패) 중단
     if (res.headersSent) {
       return;
     }
 
     // 관리자 권한 확인
     if (!req.user?.isAdmin) {
       // 데이터베이스에서 관리자 권한 재확인 (userId 기반)
       if (!req.user?.id) {
         res.status(401).json({
           success: false,
           message: '인증된 사용자 정보가 없습니다',
           code: 'MISSING_USER_INFO'
         });
         return;
       }
       
       const adminUser = await prisma.adminUser.findUnique({
         where: { userId: req.user.id },
         include: {
           user: true // User 정보도 함께 가져오기
         }
       });
     
       if (!adminUser) {
         logger.warn('관리자 권한이 없는 사용자의 접근 시도', { 
           userId: req.user?.id,
           walletAddress: req.user?.walletAddress
         });
         
         res.status(403).json({
           success: false,
           message: '관리자 권한이 필요합니다',
           code: 'ADMIN_REQUIRED'
         });
         return;
       }
     
       // 관리자 권한 정보 업데이트
       if (req.user) {
         req.user.isAdmin = true;
       }
       
       // AdminUser 의 lastLogin 업데이트
       await prisma.adminUser.update({
         where: { id: adminUser.id },
         data: { lastLogin: new Date() }
       });
       
       logger.info('관리자 인증 성공 - 데이터베이스 확인', {
         adminUserId: adminUser.id,
         role: adminUser.role,
         email: adminUser.email
       });
     }
 
     logger.info('관리자 인증 성공', { 
       userId: req.user?.id,
       walletAddress: req.user?.walletAddress.substring(0, 8) + '...'
     });
 
     next();
   } catch (error) {
     logger.error('관리자 인증 미들웨어에서 오류 발생', { error });
     res.status(500).json({
       success: false,
       message: '서버 내부 오류가 발생했습니다',
       code: 'INTERNAL_ERROR'
     });
   }
 };

/**
 * 선택적 인증 미들웨어
 * 토큰이 있으면 검증하고, 없어도 요청을 통과시킴
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      // 토큰이 없어도 통과
      next();
      return;
    }

    const payload = await verifyToken(token);
    
    if (payload) {
      // 유효한 토큰인 경우 사용자 정보 첨부
      req.user = {
        id: payload.userId,
        walletAddress: payload.walletAddress,
        isAdmin: payload.isAdmin || false
      };

      logger.info('선택적 인증 성공', { 
        userId: req.user.id,
        walletAddress: req.user.walletAddress.substring(0, 8) + '...'
      });
    } else {
      logger.info('선택적 인증: 유효하지 않은 토큰이지만 요청 허용');
    }

    next();
  } catch (error) {
    logger.error('선택적 인증 미들웨어에서 오류 발생', { error });
    // 선택적 인증에서는 오류가 발생해도 요청을 통과시킴
    next();
  }
};

/**
 * 토큰 새로고침 미들웨어
 * 만료 임박 토큰에 대해 새 토큰 발급
 */
export const refreshTokenIfNeeded = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      next();
      return;
    }

    const token = extractTokenFromHeader(req.headers.authorization);
    if (!token) {
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      next();
      return;
    }

    const decoded = jwt.decode(token) as JWTPayload;
    if (!decoded || !decoded.exp) {
      next();
      return;
    }

    // 토큰 만료까지 1시간 미만 남은 경우 새 토큰 발급
    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - currentTime;
    const oneHour = 60 * 60; // 1시간

    if (timeUntilExpiry < oneHour && timeUntilExpiry > 0) {
      const newTokenPayload: JWTPayload = {
        userId: req.user.id,
        walletAddress: req.user.walletAddress,
        isAdmin: req.user.isAdmin
      };

      const newToken = jwt.sign(newTokenPayload, jwtSecret, { 
        expiresIn: '24h' 
      });

      // 응답 헤더에 새 토큰 추가
      res.setHeader('X-New-Token', newToken);
      
      logger.info('토큰 새로고침 완료', { 
        userId: req.user.id,
        remainingTime: timeUntilExpiry
      });
    }

    next();
  } catch (error) {
    logger.error('토큰 새로고침 미들웨어에서 오류 발생', { error });
    // 토큰 새로고침 실패해도 요청은 계속 진행
    next();
  }
};

export default {
  authenticateToken,
  authenticateAdmin,
  optionalAuth,
  refreshTokenIfNeeded
};