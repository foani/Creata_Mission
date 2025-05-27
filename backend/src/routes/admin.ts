/**
  * Admin Routes - 관리자 전용 API 라우트
  * 파일: backend/routes/admin.ts
  * 
  * 기능:
  * - 사용자 관리 (조회, 상태 변경, 통계)
  * - 게임 통계 및 관리
  * - 에어드랍 관리 (대상 선정, 실행, 기록)
  * - 시스템 설정 관리
  */
 
 import express, { Request, Response, NextFunction } from 'express';
 import { PrismaClient } from '@prisma/client';
 import jwt from 'jsonwebtoken';
 import bcrypt from 'bcryptjs';
 import rateLimit from 'express-rate-limit';
 
 // TypeScript 타입 정의
 interface AdminUser {
   id: string;
   email: string;
   role: 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR';
   name: string;
   isActive: boolean;
   createdAt: Date;
   lastLoginAt: Date | null;
 }
 
 interface AuthenticatedRequest extends Request {
   admin?: AdminUser;
 }
 
 interface LoginRequestBody {
   email: string;
   password: string;
 }
 
 interface JWTPayload {
   adminId: string;
   role: AdminRole;
 }
 type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR';
 
 const router = express.Router();
const prisma = new PrismaClient();
 
 // Admin 전용 Rate Limiting
 const adminRateLimit = rateLimit({
   windowMs: 15 * 60 * 1000, // 15분
   max: 100, // 관리자는 더 많은 요청 허용
   message: {
     success: false,
     error: 'Too many requests from admin. Please try again later.'
   }
 });
 
 // Admin 인증 미들웨어
 const adminAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
   try {
     const token = req.header('Authorization')?.replace('Bearer ', '');
     
     if (!token) {
       res.status(401).json({
         success: false,
         error: 'Access denied. No token provided.'
       });
       return;
     }
 
     const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
     
     // AdminUser 테이블에서 관리자 확인
     const adminUser = await prisma.adminUser.findUnique({
       where: { id: decoded.adminId },
       select: {
         id: true,
         email: true,
         role: true,
         name: true,
         isActive: true,
         createdAt: true,
         lastLoginAt: true
       }
     });
 
     if (!adminUser || !adminUser.isActive) {
       res.status(401).json({
         success: false,
         error: 'Invalid admin credentials or account deactivated.'
       });
       return;
     }
 
     req.admin = adminUser as AdminUser;
     next();
   } catch (error) {
     console.error('Admin auth error:', error);
     res.status(401).json({
       success: false,
       error: 'Invalid token.'
     });
   }
 };
 
 // 권한 확인 미들웨어
 const checkRole = (requiredRoles: AdminRole[]) => {
   return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
     if (!req.admin || !requiredRoles.includes(req.admin.role as AdminRole)) {
       res.status(403).json({
         success: false,
         error: 'Insufficient permissions.'
       });
       return;
     }
     next();
   };
 };
 
 
 // ============================================================================
 // Admin 인증 관련 라우트
 // ============================================================================
 
 /**
  * POST /api/admin/login
  * 관리자 로그인
  */
 router.post('/login', async (req: Request<{}, {}, LoginRequestBody>, res: Response): Promise<void> => {
   try {
     const { email, password } = req.body;
 
     // 입력값 검증
     if (!email || !password) {
       res.status(400).json({
         success: false,
         error: 'Email and password are required.'
       });
       return;
     }
 
     // 관리자 계정 조회
     const adminUser = await prisma.adminUser.findUnique({
       where: { email: email.toLowerCase() }
     });
 
     if (!adminUser) {
       res.status(401).json({
         success: false,
         error: 'Invalid credentials.'
       });
       return;
     }
 
     // 계정 활성화 상태 확인
     if (!adminUser.isActive) {
       res.status(401).json({
         success: false,
         error: 'Account is deactivated.'
       });
       return;
     }
 
     // 비밀번호 확인
     const isValidPassword = await bcrypt.compare(password, adminUser.passwordHash);
     if (!isValidPassword) {
       res.status(401).json({
         success: false,
         error: 'Invalid credentials.'
       });
       return;
     }
 
     // JWT 토큰 생성
     const token = jwt.sign(
       { adminId: adminUser.id, role: adminUser.role },
       process.env.JWT_SECRET!,
       { expiresIn: '8h' } // 관리자는 8시간 유효
     );
 
     // 로그인 기록 업데이트
     await prisma.adminUser.update({
       where: { id: adminUser.id },
       data: { lastLoginAt: new Date() }
     });
 
     res.json({
       success: true,
       data: {
         token,
         admin: {
           id: adminUser.id,
           email: adminUser.email,
           role: adminUser.role,
           name: adminUser.name
         }
       }
     });
 
   } catch (error) {
     console.error('Admin login error:', error);
     res.status(500).json({
       success: false,
       error: 'Internal server error during login.'
     });
   }
 });
 
 /**
  * GET /api/admin/dashboard/stats
  * 대시보드 메인 통계
  */
 router.get('/dashboard/stats', adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
   try {
     // 병렬로 모든 통계 데이터 조회
     const [
       totalUsers,
       activeUsers,
       totalGames,
       totalAirdrops
     ] = await Promise.all([
       prisma.user.count(),
       prisma.user.count({
         where: {
           lastLoginAt: {
             gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
           }
         }
       }),
       prisma.gameLog.count(),
       prisma.airdropQueue.count({
         where: { status: 'COMPLETED' }
       })
     ]);
 
     res.json({
       success: true,
       data: {
         overview: {
           totalUsers,
           activeUsers,
           totalGames,
           totalAirdrops
         }
       }
     });
 
   } catch (error) {
     console.error('Dashboard stats error:', error);
     res.status(500).json({
       success: false,
       error: 'Failed to fetch dashboard statistics.'
     });
   }
 });
 
 /**
  * GET /api/admin/users
  * 사용자 목록 조회 (필터링, 페이지네이션)
  */
 router.get('/users', adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
   try {
     const { 
       page = 1, 
       limit = 20, 
       verified,
       language,
       search 
     } = req.query;
 
     const skip = (Number(page) - 1) * Number(limit);
     const take = Number(limit);
 
     // 필터 조건 구성
     const where: any = {};
     
     if (verified !== undefined) {
       where.isVerified = verified === 'true';
     }
     
     if (language) {
       where.preferredLanguage = language;
     }
     
     if (search) {
       where.OR = [
         { walletAddress: { contains: search as string, mode: 'insensitive' } },
         { telegramId: { contains: search as string, mode: 'insensitive' } }
       ];
     }
 
     const [users, total] = await Promise.all([
       prisma.user.findMany({
         where,
         select: {
           id: true,
           walletAddress: true,
           telegramId: true,
           isVerified: true,
           preferredLanguage: true,
           totalScore: true,
           createdAt: true,
           updatedAt: true,
           _count: {
             select: {
               gameLogs: true
             }
           }
         },
         skip,
         take,
         orderBy: { createdAt: 'desc' }
       }),
       prisma.user.count({ where })
     ]);
 
     res.json({
       success: true,
       data: {
         users,
         pagination: {
           page: Number(page),
           limit: Number(limit),
           total,
           pages: Math.ceil(total / Number(limit))
         }
       }
     });
 
   } catch (error) {
     console.error('Get users error:', error);
     res.status(500).json({
       success: false,
       error: 'Failed to fetch users.'
     });
   }
 });
 
 /**
  * POST /api/admin/users/update-verification
  * 사용자 인증 상태 변경
  */
 router.post('/users/update-verification', adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
   try {
     const { walletAddress, isVerified } = req.body;
 
     if (!walletAddress || typeof isVerified !== 'boolean') {
       res.status(400).json({
         success: false,
         error: 'Invalid request data.'
       });
       return;
     }
 
     const user = await prisma.user.update({
       where: { walletAddress },
       data: { 
         isVerified,
         updatedAt: new Date()
       },
       select: {
         id: true,
         walletAddress: true,
         isVerified: true,
         updatedAt: true
       }
     });
 
     res.json({
       success: true,
       data: user,
       message: `User verification ${isVerified ? 'enabled' : 'disabled'} successfully.`
     });
 
   } catch (error) {
     console.error('Update user verification error:', error);
     res.status(500).json({
       success: false,
       error: 'Failed to update user verification.'
     });
   }
 });
 
 /**
  * GET /api/admin/games/logs
  * 게임 로그 조회 (필터링, 페이지네이션)
  */
 router.get('/games/logs', adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
   try {
     const { 
       page = 1, 
       limit = 50, 
       gameType,
       walletAddress,
       startDate,
       endDate 
     } = req.query;
 
     const skip = (Number(page) - 1) * Number(limit);
     const take = Number(limit);
 
     // 필터 조건 구성
     const where: any = {};
     
     if (gameType) {
       where.gameType = gameType;
     }
     
     if (walletAddress) {
       where.walletAddress = walletAddress;
     }
     
     if (startDate || endDate) {
       where.createdAt = {};
       if (startDate) where.createdAt.gte = new Date(startDate as string);
       if (endDate) where.createdAt.lte = new Date(endDate as string);
     }
 
     const [logs, total] = await Promise.all([
       prisma.gameLog.findMany({
         where,
         include: {
           user: {
             select: {
               walletAddress: true,
               telegramId: true,
               isVerified: true
             }
           }
         },
         skip,
         take,
         orderBy: { createdAt: 'desc' }
       }),
       prisma.gameLog.count({ where })
     ]);
 
     res.json({
       success: true,
       data: {
         logs,
         pagination: {
           page: Number(page),
           limit: Number(limit),
           total,
           pages: Math.ceil(total / Number(limit))
         }
       }
     });
 
   } catch (error) {
     console.error('Get game logs error:', error);
     res.status(500).json({
       success: false,
       error: 'Failed to fetch game logs.'
     });
   }
 });
 
 /**
  * GET /api/admin/games/stats
  * 게임 통계 조회
  */
 router.get('/games/stats', adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
   try {
     const { gameType, period = '7d' } = req.query;
 
     // 기간 설정
     let startDate: Date;
     switch (period) {
       case '1d':
         startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
         break;
       case '7d':
         startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
         break;
       case '30d':
         startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
         break;
       default:
         startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
     }
 
     const where: any = {
       createdAt: { gte: startDate }
     };
     
     if (gameType) {
       where.gameType = gameType;
     }
 
     const [gameStats, topPlayers] = await Promise.all([
       // 게임별 통계
       prisma.gameLog.groupBy({
         by: ['gameType'],
         where,
         _count: { id: true },
         _avg: { score: true },
         _max: { score: true },
         _sum: { score: true }
       }),
       // 상위 플레이어
       prisma.gameLog.groupBy({
         by: ['walletAddress'],
         where,
         _count: { id: true },
         _sum: { score: true },
         orderBy: { _sum: { score: 'desc' } },
         take: 10
       })
     ]);
 
     res.json({
       success: true,
       data: {
         gameStats,
         topPlayers,
         period,
         startDate,
         endDate: new Date()
       }
     });
 
   } catch (error) {
     console.error('Get game stats error:', error);
     res.status(500).json({
       success: false,
       error: 'Failed to fetch game statistics.'
     });
   }
 });
 
 /**
  * DELETE /api/admin/games/logs/:id
  * 게임 로그 삭제 (부정행위 대응)
  */
 router.delete('/games/logs/:id', adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
   try {
     const { id } = req.params;
     const { reason } = req.body;
 
     if (!id) {
       res.status(400).json({
         success: false,
         error: 'Game log ID is required.'
       });
       return;
     }
 
     // 게임 로그 존재 확인
     const gameLog = await prisma.gameLog.findUnique({
       where: { id },
       include: { user: true }
     });
 
     if (!gameLog) {
       res.status(404).json({
         success: false,
         error: 'Game log not found.'
       });
       return;
     }
 
     // 사용자 총 점수에서 해당 점수 차감
     await prisma.$transaction([
       // 게임 로그 삭제
       prisma.gameLog.delete({ where: { id } }),
       // 사용자 총 점수 업데이트
       prisma.user.update({
         where: { id: gameLog.userId },
         data: {
           totalScore: {
             decrement: gameLog.score
           },
           updatedAt: new Date()
         }
       })
     ]);
 
     res.json({
       success: true,
       message: 'Game log deleted successfully.',
       data: {
         deletedLog: {
           id: gameLog.id,
           walletAddress: gameLog.walletAddress,
           gameType: gameLog.gameType,
           score: gameLog.score,
           reason: reason || 'Admin action'
         }
       }
     });
 
   } catch (error) {
     console.error('Delete game log error:', error);
     res.status(500).json({
       success: false,
       error: 'Failed to delete game log.'
     });
   }
 });
 
 /**
  * GET /api/admin/airdrops
  * 에어드랍 대기열 조회
  */
 router.get('/airdrops', adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
   try {
     const { 
       page = 1, 
       limit = 50, 
       status = 'all' 
     } = req.query;
 
     const skip = (Number(page) - 1) * Number(limit);
     const take = Number(limit);
 
     // 필터 조건 구성
     const where: any = {};
     
     if (status !== 'all') {
       where.status = status;
     }
 
     const [airdrops, total] = await Promise.all([
       prisma.airdropQueue.findMany({
         where,
         include: {
           user: {
             select: {
               walletAddress: true,
               telegramId: true,
               isVerified: true
             }
           }
         },
         skip,
         take,
         orderBy: { createdAt: 'desc' }
       }),
       prisma.airdropQueue.count({ where })
     ]);
 
     res.json({
       success: true,
       data: {
         airdrops,
         pagination: {
           page: Number(page),
           limit: Number(limit),
           total,
           pages: Math.ceil(total / Number(limit))
         }
       }
     });
 
   } catch (error) {
     console.error('Get airdrops error:', error);
     res.status(500).json({
       success: false,
       error: 'Failed to fetch airdrops.'
     });
   }
 });
 
 /**
  * POST /api/admin/airdrops/create
  * 수동 에어드랍 생성
  */
 router.post('/airdrops/create', adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
   try {
     const { walletAddress, rewardType, ctaAmount, reason } = req.body;
 
     if (!walletAddress || !rewardType || !ctaAmount) {
       res.status(400).json({
         success: false,
         error: 'Missing required fields: walletAddress, rewardType, ctaAmount'
       });
       return;
     }
 
     // 사용자 존재 확인
     const user = await prisma.user.findUnique({
       where: { walletAddress }
     });
 
     if (!user) {
       res.status(404).json({
         success: false,
         error: 'User not found.'
       });
       return;
     }
 
     // 에어드랍 대기열에 추가
     const airdrop = await prisma.airdropQueue.create({
       data: {
         userId: user.id,
         walletAddress,
         rewardType,
         ctaAmount: Number(ctaAmount),
         reason: reason || 'Manual admin airdrop',
         status: 'PENDING'
       },
       include: {
         user: {
           select: {
             walletAddress: true,
             telegramId: true,
             isVerified: true
           }
         }
       }
     });
 
     res.json({
       success: true,
       data: airdrop,
       message: 'Manual airdrop created successfully.'
     });
 
   } catch (error) {
     console.error('Create manual airdrop error:', error);
     res.status(500).json({
       success: false,
       error: 'Failed to create manual airdrop.'
     });
   }
 });
 
 /**
  * POST /api/admin/airdrops/process
  * 에어드랍 실행
  */
 router.post('/airdrops/process', adminAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
   try {
     const { batchSize = 10 } = req.body;
 
     // PENDING 상태의 에어드랍들을 배치 크기만큼 조회
     const pendingAirdrops = await prisma.airdropQueue.findMany({
       where: { status: 'PENDING' },
       take: Number(batchSize),
       orderBy: { createdAt: 'asc' },
       include: {
         user: {
           select: {
             walletAddress: true,
             isVerified: true
           }
         }
       }
     });
 
     if (pendingAirdrops.length === 0) {
       res.json({
         success: true,
         message: 'No pending airdrops to process.',
         data: { processed: 0 }
       });
       return;
     }
 
     const results = [];
     let successCount = 0;
     let failCount = 0;
 
     // 각 에어드랍 처리
     for (const airdrop of pendingAirdrops) {
       try {
         // 실제 블록체인 전송은 여기서 구현
         // 현재는 시뮬레이션으로 처리
         const success = Math.random() > 0.1; // 90% 성공률 시뮬레이션
         
         if (success) {
           // 성공 시 상태 업데이트
           await prisma.airdropQueue.update({
             where: { id: airdrop.id },
             data: {
               status: 'COMPLETED',
               processedAt: new Date(),
               txHash: `0x${Math.random().toString(16).substr(2, 64)}` // 가짜 트랜잭션 해시
             }
           });
           successCount++;
         } else {
           // 실패 시 상태 업데이트
           await prisma.airdropQueue.update({
             where: { id: airdrop.id },
             data: {
               status: 'FAILED',
               processedAt: new Date(),
               error: 'Transaction failed'
             }
           });
           failCount++;
         }
 
         results.push({
           id: airdrop.id,
           walletAddress: airdrop.walletAddress,
           ctaAmount: airdrop.ctaAmount,
           status: success ? 'COMPLETED' : 'FAILED'
         });
 
       } catch (error) {
         console.error(`Airdrop processing error for ${airdrop.id}:`, error);
         failCount++;
       }
     }
 
     res.json({
       success: true,
       message: `Processed ${successCount + failCount} airdrops. ${successCount} successful, ${failCount} failed.`,
       data: {
         processed: successCount + failCount,
         successful: successCount,
         failed: failCount,
         results
       }
     });
 
   } catch (error) {
     console.error('Process airdrops error:', error);
     res.status(500).json({
       success: false,
       error: 'Failed to process airdrops.'
     });
   }
 });
 
 // 모든 admin 라우트에 rate limiting 적용
 router.use(adminRateLimit);
 
 export default router;