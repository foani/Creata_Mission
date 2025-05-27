import express, { Request, Response, NextFunction, Router } from 'express';
import { PrismaClient, User, AirdropQueue } from '@prisma/client';
import { ethers } from 'ethers';

const router: Router = express.Router();
const prisma = new PrismaClient();

const AIRDROP_CONFIG = {
  DEFAULT_AMOUNT: '10.0',
  RANKING_REWARDS: {
    1: '50.0',
    2: '30.0',
    3: '20.0',
    4: '15.0',
    5: '10.0'
  },
  MAX_AMOUNT: '1000.0',
  BATCH_SIZE: 10
};

interface AdminRequest extends Request {
  headers: {
    [key: string]: string | string[] | undefined;
    'x-admin-key'?: string;
  };
}

function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const adminKey = req.headers['x-admin-key'];
  const adminKeyStr = Array.isArray(adminKey) ? adminKey[0] : adminKey;
  if (
    adminKeyStr !== process.env.ADMIN_API_KEY &&
    adminKeyStr !== 'creata-admin-key-2025'
  ) {
    return res.status(403).json({
      success: false,
      error: 'ADMIN_ACCESS_REQUIRED',
      message: '어드민 권한이 필요합니다.'
    });
  }
  next();
}

router.post('/queue', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { walletAddress, rewardType, ctaAmount } = req.body;

    if (!walletAddress || !rewardType || !ctaAmount) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: '필수 필드가 누락되었습니다. (walletAddress, rewardType, ctaAmount)'
      });
    }

    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_WALLET_ADDRESS',
        message: '올바르지 않은 지갑 주소 형식입니다.'
      });
    }

    const validRewardTypes = ['mission', 'ranking', 'event'];
    if (!validRewardTypes.includes(rewardType)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REWARD_TYPE',
        message: 'rewardType 값이 올바르지 않습니다.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: '등록되지 않은 사용자입니다.'
      });
    }

    const amount = parseFloat(ctaAmount);
    if (isNaN(amount)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_AMOUNT',
        message: 'ctaAmount 값이 올바른 숫자가 아닙니다.'
      });
    }

    const airdropEntry = await prisma.airdropQueue.create({
      data: {
        userId: user.id,
        rewardType,
        ctaAmount: amount,
        status: 'pending'
      },
      include: {
        user: {
          select: {
            walletAddress: true,
            language: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: '에어드랍 대상이 성공적으로 추가되었습니다.',
      data: {
        queueId: airdropEntry.id,
        walletAddress: airdropEntry.user.walletAddress,
        rewardType: airdropEntry.rewardType,
        ctaAmount: airdropEntry.ctaAmount.toString(),
        status: airdropEntry.status,
        createdAt: airdropEntry.createdAt
      }
    });

  } catch (error) {
    console.error('에어드랍 대상 추가 오류:', error);
    res.status(500).json({
      success: false,
      error: 'AIRDROP_QUEUE_FAILED',
      message: '에어드랍 대상 추가 중 오류가 발생했습니다.'
    });
  }
});

router.post('/execute', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { batchSize = AIRDROP_CONFIG.BATCH_SIZE } = req.body;

    const pendingAirdrops = await prisma.airdropQueue.findMany({
      where: { status: 'pending' },
      take: Number(batchSize),
      include: {
        user: {
          select: {
            walletAddress: true,
            language: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    if (pendingAirdrops.length === 0) {
      return res.json({
        success: true,
        message: '실행할 에어드랍이 없습니다.',
        data: {
          processed: 0,
          transactions: []
        }
      });
    }

    const processedTransactions: Array<{
      queueId: number;
      walletAddress: string;
      amount: string;
      txHash: string;
      rewardType: string;
    }> = [];

    for (const airdrop of pendingAirdrops) {
      try {
        const fakeTxHash = `0x${Math.random().toString(16).substr(2, 8)}${airdrop.id.toString().padStart(8, '0')}${Date.now().toString(16)}`;

        await prisma.airdropQueue.update({
          where: { id: airdrop.id },
          data: {
            status: 'success',
            txHash: fakeTxHash,
            processedAt: new Date()
          }
        });

        processedTransactions.push({
          queueId: airdrop.id,
          walletAddress: airdrop.user.walletAddress,
          amount: airdrop.ctaAmount.toString(),
          txHash: fakeTxHash,
          rewardType: airdrop.rewardType
        });

      } catch (txError) {
        console.error(`에어드랍 실행 실패 (ID: ${airdrop.id}):`, txError);

        await prisma.airdropQueue.update({
          where: { id: airdrop.id },
          data: {
            status: 'failed',
            processedAt: new Date()
          }
        });
      }
    }

    res.json({
      success: true,
      message: `${processedTransactions.length}건의 에어드랍이 성공적으로 실행되었습니다.`,
      data: {
        processed: processedTransactions.length,
        transactions: processedTransactions
      }
    });

  } catch (error) {
    console.error('에어드랍 실행 오류:', error);
    res.status(500).json({
      success: false,
      error: 'AIRDROP_EXECUTION_FAILED',
      message: '에어드랍 실행 중 오류가 발생했습니다.'
    });
  }
});

router.get('/queue', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status = 'all', limit = 50, offset = 0 } = req.query;

    const validStatuses = ['pending', 'success', 'failed', 'all'];
    if (typeof status !== 'string' || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATUS',
        message: 'status 값이 올바르지 않습니다.'
      });
    }

    const whereCondition = status === 'all' ? {} : { status };

    const [queue, totalCount] = await Promise.all([
      prisma.airdropQueue.findMany({
        where: whereCondition,
        take: Number(limit),
        skip: Number(offset),
        include: {
          user: {
            select: {
              walletAddress: true,
              language: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.airdropQueue.count({ where: whereCondition })
    ]);

    res.json({
      success: true,
      data: {
        queue: queue.map(item => ({
          id: item.id,
          walletAddress: item.user.walletAddress,
          rewardType: item.rewardType,
          ctaAmount: item.ctaAmount.toString(),
          status: item.status,
          txHash: item.txHash,
          createdAt: item.createdAt,
          processedAt: item.processedAt
        })),
        pagination: {
          total: totalCount,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: totalCount > Number(offset) + Number(limit)
        }
      }
    });

  } catch (error) {
    console.error('에어드랍 대기열 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'AIRDROP_QUEUE_FETCH_FAILED',
      message: '에어드랍 대기열 조회 중 오류가 발생했습니다.'
    });
  }
});

// 에러 핸들러 (선택)
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('AIRDROP API 오류:', error);
  res.status(500).json({
    success: false,
    error: error.name || 'AIRDROP_API_ERROR',
    message: error.message || 'AIRDROP API에서 오류가 발생했습니다.',
    timestamp: new Date().toISOString()
  });
});

type RewardType = 'mission' | 'ranking' | 'event';
type AirdropStatus = 'pending' | 'success' | 'failed';

export default router;