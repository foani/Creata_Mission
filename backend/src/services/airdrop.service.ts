// backend/src/services/airdrop.service.ts
// 실전급 에어드랍 서비스 - CTA 토큰 에어드랍 및 보상 관리

import { PrismaClient, Prisma } from '@prisma/client';
import { ethers } from 'ethers';

// 싱글톤 패턴으로 PrismaClient 관리
class DatabaseManager {
  private static instance: PrismaClient;
  
  static getInstance(): PrismaClient {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new PrismaClient();
    }
    return DatabaseManager.instance;
  }
}

// 환경 변수 안전하게 파싱하는 헬퍼 함수
const safeParseFloat = (value: string | undefined, defaultValue: number): number => {
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const safeParseInt = (value: string | undefined, defaultValue: number): number => {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// 환경변수에서 에어드랍 설정 가져오기 - 하드코딩 제거
const AIRDROP_CONFIG = {
  DEFAULT_AMOUNT: safeParseFloat(process.env.AIRDROP_DEFAULT_AMOUNT, 10.0), // 하드코딩된 기본 CTA 수량
  RANKING_REWARDS: {
    1: safeParseFloat(process.env.AIRDROP_RANK_1_REWARD, 50.0), // 하드코딩된 1등 보상
    2: safeParseFloat(process.env.AIRDROP_RANK_2_REWARD, 30.0), // 하드코딩된 2등 보상
    3: safeParseFloat(process.env.AIRDROP_RANK_3_REWARD, 20.0), // 하드코딩된 3등 보상
    4: safeParseFloat(process.env.AIRDROP_RANK_4_REWARD, 15.0), // 하드코딩된 4등 보상
    5: safeParseFloat(process.env.AIRDROP_RANK_5_REWARD, 10.0)  // 하드코딩된 5등 보상
  },
  MAX_AMOUNT: safeParseFloat(process.env.AIRDROP_MAX_AMOUNT, 1000.0), // 하드코딩된 최대 에어드랍 수량
  MIN_AMOUNT: safeParseFloat(process.env.AIRDROP_MIN_AMOUNT, 1.0), // 하드코딩된 최소 에어드랍 수량
  BATCH_SIZE: safeParseInt(process.env.AIRDROP_BATCH_SIZE, 10), // 하드코딩된 일괄 처리 크기
  MAX_RETRIES: safeParseInt(process.env.AIRDROP_MAX_RETRIES, 3), // 하드코딩된 최대 재시도 횟수
  RETRY_DELAY: safeParseInt(process.env.AIRDROP_RETRY_DELAY, 5000), // 하드코딩된 재시도 지연시간 (ms)
  GAS_LIMIT: safeParseInt(process.env.AIRDROP_GAS_LIMIT, 100000), // 하드코딩된 가스 한도
  TOP_RANKS_COUNT: safeParseInt(process.env.AIRDROP_TOP_RANKS, 5) // 하드코딩된 상위 랭킹 수
};

// CreataChain 네트워크 설정
const NETWORK_CONFIG = {
  RPC_URL: process.env.CREATA_RPC_URL || 'https://cvm.node.creatachain.com',
  CHAIN_ID: parseInt(process.env.CREATA_CHAIN_ID || '1000'),
  PRIVATE_KEY: process.env.AIRDROP_PRIVATE_KEY, // 에어드랍 전송 계정 프라이빗 키
  CTA_TOKEN_ADDRESS: process.env.CTA_TOKEN_ADDRESS // CTA 토큰 컨트랙트 주소
};

// 필수 환경변수 검증
if (!NETWORK_CONFIG.PRIVATE_KEY) {
  throw new Error('AIRDROP_PRIVATE_KEY 환경변수가 설정되지 않았습니다.');
}
if (!NETWORK_CONFIG.CTA_TOKEN_ADDRESS) {
  throw new Error('CTA_TOKEN_ADDRESS 환경변수가 설정되지 않았습니다.');
}

// 에어드랍 큐 생성 요청 인터페이스
export interface AirdropQueueRequest {
  walletAddress: string;
  rewardType: 'ranking' | 'event' | 'referral' | 'bonus' | 'admin';
  ctaAmount: number;
  description?: string;
  metadata?: Record<string, any>;
}

// 에어드랍 실행 요청 인터페이스
export interface AirdropExecuteRequest {
  queueIds?: number[];
  rewardType?: string;
  maxAmount?: number;
  dryRun?: boolean;
}

// 에어드랍 응답 인터페이스
export interface AirdropResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

// 에어드랍 실행 결과 인터페이스
export interface AirdropExecuteResult {
  success: boolean;
  processed: number;
  failed: number;
  totalAmount: number;
  transactions: Array<{
    id: number;
    walletAddress: string;
    amount: number;
    txHash?: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
  error?: string;
  message?: string;
}

// 랭킹 기반 에어드랍 생성 요청 인터페이스
export interface RankingAirdropRequest {
  language?: string;
  customRewards?: Record<number, number>; // 순위별 커스텀 보상액
  description?: string;
}

export class AirdropService {
  private prisma: PrismaClient;
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private ctaToken?: ethers.Contract;

  constructor() {
    this.prisma = DatabaseManager.getInstance();
    this.provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.RPC_URL);
    this.wallet = new ethers.Wallet(NETWORK_CONFIG.PRIVATE_KEY!, this.provider);
    
    // CTA 토큰 컨트랙트 초기화 (ERC20 표준)
    if (NETWORK_CONFIG.CTA_TOKEN_ADDRESS) {
      const erc20Abi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
        'event Transfer(address indexed from, address indexed to, uint256 value)'
      ];
      this.ctaToken = new ethers.Contract(NETWORK_CONFIG.CTA_TOKEN_ADDRESS, erc20Abi, this.wallet);
    }
  }

  /**
   * 입력값 검증
   */
  private validateAirdropRequest(request: AirdropQueueRequest): { valid: boolean; error?: string } {
    const { walletAddress, rewardType, ctaAmount } = request;

    // 지갑 주소 검증
    if (!ethers.isAddress(walletAddress)) {
      return { valid: false, error: '올바르지 않은 지갑 주소 형식입니다.' };
    }

    // 보상 타입 검증
    const validRewardTypes = ['ranking', 'event', 'referral', 'bonus', 'admin'];
    if (!validRewardTypes.includes(rewardType)) {
      return { valid: false, error: `올바르지 않은 보상 타입입니다. 지원 타입: ${validRewardTypes.join(', ')}` };
    }

    // 금액 검증
    if (typeof ctaAmount !== 'number' || ctaAmount <= 0) {
      return { valid: false, error: 'CTA 수량은 0보다 큰 숫자여야 합니다.' };
    }

    if (ctaAmount < AIRDROP_CONFIG.MIN_AMOUNT) {
      return { valid: false, error: `최소 에어드랍 수량은 ${AIRDROP_CONFIG.MIN_AMOUNT} CTA입니다.` };
    }

    if (ctaAmount > AIRDROP_CONFIG.MAX_AMOUNT) {
      return { valid: false, error: `최대 에어드랍 수량은 ${AIRDROP_CONFIG.MAX_AMOUNT} CTA입니다.` };
    }

    return { valid: true };
  }

  /**
   * 에어드랍 큐에 추가
   */
  async addToQueue(request: AirdropQueueRequest): Promise<AirdropResponse> {
    // 입력값 검증
    const validation = this.validateAirdropRequest(request);
    if (!validation.valid) {
      return {
        success: false,
        error: 'INVALID_INPUT',
        message: validation.error
      };
    }

    const { walletAddress, rewardType, ctaAmount, description, metadata } = request;

    try {
      // 사용자 존재 여부 확인
      const user = await this.prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() }
      });

      if (!user) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: '등록되지 않은 사용자입니다.'
        };
      }

      // 중복 큐 확인 (같은 사용자, 같은 보상 타입, pending 상태)
      const existingQueue = await this.prisma.airdropQueue.findFirst({
        where: {
          userId: user.id,
          rewardType,
          status: 'pending'
        }
      });

      if (existingQueue) {
        return {
          success: false,
          error: 'DUPLICATE_QUEUE',
          message: '동일한 보상 타입의 대기 중인 에어드랍이 이미 존재합니다.'
        };
      }

      // 에어드랍 큐에 추가
      const airdropQueue = await this.prisma.airdropQueue.create({
        data: {
          userId: user.id,
          rewardType,
          ctaAmount: ctaAmount.toString(),
          description: description || `${rewardType} reward`,
          metadata: metadata || {},
          status: 'pending',
          createdAt: new Date()
        }
      });

      return {
        success: true,
        message: '에어드랍 큐에 성공적으로 추가되었습니다.',
        data: {
          queueId: airdropQueue.id,
          walletAddress: user.walletAddress,
          ctaAmount,
          rewardType
        }
      };

    } catch (error) {
      console.error('에어드랍 큐 추가 오류:', error);
      return {
        success: false,
        error: 'QUEUE_ADD_FAILED',
        message: '에어드랍 큐 추가 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 랭킹 기반 에어드랍 생성
   */
  async createRankingAirdrop(request: RankingAirdropRequest = {}): Promise<AirdropResponse> {
    const { language, customRewards, description } = request;

    try {
      // 상위 랭킹 사용자 조회
      const whereCondition: any = {
        score: { gte: 1 },
        isWalletVerified: true
      };

      if (language) {
        whereCondition.language = language;
      }

      const topUsers = await this.prisma.user.findMany({
        where: whereCondition,
        orderBy: [
          { score: 'desc' },
          { createdAt: 'asc' }
        ],
        take: AIRDROP_CONFIG.TOP_RANKS_COUNT,
        select: {
          id: true,
          walletAddress: true,
          score: true,
          language: true
        }
      });

      if (topUsers.length === 0) {
        return {
          success: false,
          error: 'NO_ELIGIBLE_USERS',
          message: '에어드랍 대상자가 없습니다.'
        };
      }

      // 랭킹별 보상 생성
      const airdropPromises = topUsers.map(async (user, index) => {
        const rank = index + 1;
        const rewardAmount = customRewards?.[rank] || AIRDROP_CONFIG.RANKING_REWARDS[rank as keyof typeof AIRDROP_CONFIG.RANKING_REWARDS] || 0;

        if (rewardAmount <= 0) return null;

        return this.prisma.airdropQueue.create({
          data: {
            userId: user.id,
            rewardType: 'ranking',
            ctaAmount: rewardAmount.toString(),
            description: description || `Rank ${rank} reward (${user.score} points)`,
            metadata: {
              rank,
              score: user.score,
              language: user.language
            },
            status: 'pending'
          }
        });
      });

      // 병렬로 에어드랍 큐 생성
      const results = await Promise.all(airdropPromises);
      const created = results.filter(result => result !== null);

      return {
        success: true,
        message: `${created.length}명의 상위 랭킹 사용자에 대한 에어드랍이 생성되었습니다.`,
        data: {
          created: created.length,
          totalAmount: created.reduce((sum, item) => sum + parseFloat(item!.ctaAmount), 0),
          rankings: topUsers.map((user, index) => ({
            rank: index + 1,
            walletAddress: user.walletAddress,
            score: user.score,
            reward: customRewards?.[index + 1] || AIRDROP_CONFIG.RANKING_REWARDS[(index + 1) as keyof typeof AIRDROP_CONFIG.RANKING_REWARDS] || 0
          }))
        }
      };

    } catch (error) {
      console.error('랭킹 에어드랍 생성 오류:', error);
      return {
        success: false,
        error: 'RANKING_AIRDROP_FAILED',
        message: '랭킹 기반 에어드랍 생성 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * CTA 토큰 전송 (실제 블록체인 트랜잭션)
   */
  private async sendCTAToken(toAddress: string, amount: number, retries = 0): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.ctaToken) {
      return { success: false, error: 'CTA 토큰 컨트랙트가 초기화되지 않았습니다.' };
    }

    try {
      // 토큰 decimals 확인 (일반적으로 18)
      const decimals = await this.ctaToken.decimals();
      const amountInWei = ethers.parseUnits(amount.toString(), decimals);

      // 잔액 확인
      const balance = await this.ctaToken.balanceOf(this.wallet.address);
      if (balance < amountInWei) {
        return { success: false, error: '전송 계정의 CTA 토큰 잔액이 부족합니다.' };
      }

      // 트랜잭션 전송
      const tx = await this.ctaToken.transfer(toAddress, amountInWei, {
        gasLimit: AIRDROP_CONFIG.GAS_LIMIT
      });

      // 트랜잭션 확인 대기
      const receipt = await tx.wait();

      if (receipt?.status === 1) {
        return { success: true, txHash: receipt.hash };
      } else {
        return { success: false, error: '트랜잭션이 실패했습니다.' };
      }

    } catch (error: any) {
      console.error(`CTA 전송 오류 (시도 ${retries + 1}):`, error);

      // 재시도 로직
      if (retries < AIRDROP_CONFIG.MAX_RETRIES) {
        console.log(`${AIRDROP_CONFIG.RETRY_DELAY}ms 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, AIRDROP_CONFIG.RETRY_DELAY));
        return this.sendCTAToken(toAddress, amount, retries + 1);
      }

      return { 
        success: false, 
        error: error.message || '알 수 없는 오류가 발생했습니다.' 
      };
    }
  }

  /**
   * 에어드랍 실행
   */
  async executeAirdrop(request: AirdropExecuteRequest = {}): Promise<AirdropExecuteResult> {
    const { queueIds, rewardType, maxAmount, dryRun = false } = request;

    try {
      // 실행할 에러드랍 큐 조회
      const whereCondition: any = {
        status: 'pending'
      };

      if (queueIds && queueIds.length > 0) {
        whereCondition.id = { in: queueIds };
      }

      if (rewardType) {
        whereCondition.rewardType = rewardType;
      }

      const pendingAirdrops = await this.prisma.airdropQueue.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              walletAddress: true
            }
          }
        },
        take: AIRDROP_CONFIG.BATCH_SIZE,
        orderBy: { createdAt: 'asc' }
      });

      if (pendingAirdrops.length === 0) {
        return {
          success: false,
          processed: 0,
          failed: 0,
          totalAmount: 0,
          transactions: [],
          message: '실행할 에어드랍이 없습니다.'
        };
      }

      // 총 금액 제한 확인
      const totalAmount = pendingAirdrops.reduce((sum, airdrop) => sum + parseFloat(airdrop.ctaAmount), 0);
      if (maxAmount && totalAmount > maxAmount) {
        return {
          success: false,
          processed: 0,
          failed: 0,
          totalAmount,
          transactions: [],
          error: 'AMOUNT_LIMIT_EXCEEDED',
          message: `총 에어드랍 금액(${totalAmount} CTA)이 제한(${maxAmount} CTA)을 초과합니다.`
        };
      }

      // Dry run 모드
      if (dryRun) {
        const dryRunTransactions = pendingAirdrops.map(airdrop => ({
          id: airdrop.id,
          walletAddress: airdrop.user.walletAddress,
          amount: parseFloat(airdrop.ctaAmount),
          status: 'success' as const
        }));

        return {
          success: true,
          processed: pendingAirdrops.length,
          failed: 0,
          totalAmount,
          transactions: dryRunTransactions,
          message: `Dry run 완료: ${pendingAirdrops.length}개 에어드랍, 총 ${totalAmount} CTA`
        };
      }

      // 실제 에어드랍 실행
      const transactions: AirdropExecuteResult['transactions'] = [];
      let processed = 0;
      let failed = 0;

      for (const airdrop of pendingAirdrops) {
        const amount = parseFloat(airdrop.ctaAmount);
        const walletAddress = airdrop.user.walletAddress;

        // CTA 토큰 전송
        const sendResult = await this.sendCTAToken(walletAddress, amount);

        if (sendResult.success) {
          // 성공 시 DB 업데이트
          await this.prisma.airdropQueue.update({
            where: { id: airdrop.id },
            data: {
              status: 'success',
              txHash: sendResult.txHash,
              processedAt: new Date()
            }
          });

          transactions.push({
            id: airdrop.id,
            walletAddress,
            amount,
            txHash: sendResult.txHash,
            status: 'success'
          });

          processed++;
          console.log(`에어드랍 성공: ${walletAddress} - ${amount} CTA - ${sendResult.txHash}`);

        } else {
          // 실패 시 DB 업데이트
          await this.prisma.airdropQueue.update({
            where: { id: airdrop.id },
            data: {
              status: 'failed',
              processedAt: new Date(),
              metadata: {
                ...airdrop.metadata,
                error: sendResult.error
              }
            }
          });

          transactions.push({
            id: airdrop.id,
            walletAddress,
            amount,
            status: 'failed',
            error: sendResult.error
          });

          failed++;
          console.error(`에어드랍 실패: ${walletAddress} - ${amount} CTA - ${sendResult.error}`);
        }

        // 배치 처리 간 지연 (네트워크 부하 방지)
        if (processed + failed < pendingAirdrops.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return {
        success: true,
        processed,
        failed,
        totalAmount,
        transactions,
        message: `에어드랍 완료: 성공 ${processed}개, 실패 ${failed}개, 총 ${totalAmount} CTA`
      };

    } catch (error) {
      console.error('에어드랍 실행 오류:', error);
      return {
        success: false,
        processed: 0,
        failed: 0,
        totalAmount: 0,
        transactions: [],
        error: 'EXECUTION_FAILED',
        message: '에어드랍 실행 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 에어드랍 큐 조회
   */
  async getAirdropQueue(filters: {
    status?: 'pending' | 'success' | 'failed';
    rewardType?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const { status, rewardType, limit = 20, offset = 0 } = filters;

    try {
      const whereCondition: any = {};
      if (status) whereCondition.status = status;
      if (rewardType) whereCondition.rewardType = rewardType;

      const [queueItems, total] = await Promise.all([
        this.prisma.airdropQueue.findMany({
          where: whereCondition,
          include: {
            user: {
              select: {
                walletAddress: true,
                language: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        this.prisma.airdropQueue.count({ where: whereCondition })
      ]);

      return {
        success: true,
        data: {
          items: queueItems.map(item => ({
            id: item.id,
            walletAddress: item.user.walletAddress,
            rewardType: item.rewardType,
            ctaAmount: parseFloat(item.ctaAmount),
            description: item.description,
            status: item.status,
            txHash: item.txHash,
            createdAt: item.createdAt,
            processedAt: item.processedAt,
            metadata: item.metadata
          })),
          pagination: {
            total,
            limit,
            offset,
            hasMore: total > offset + limit
          }
        }
      };

    } catch (error) {
      console.error('에어드랍 큐 조회 오류:', error);
      return {
        success: false,
        error: 'QUEUE_FETCH_FAILED',
        message: '에어드랍 큐 조회 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 에어드랍 통계 조회
   */
  async getAirdropStats() {
    try {
      const [totalStats, statusStats, rewardTypeStats] = await Promise.all([
        this.prisma.airdropQueue.aggregate({
          _sum: { ctaAmount: true },
          _count: { id: true }
        }),
        this.prisma.airdropQueue.groupBy({
          by: ['status'],
          _sum: { ctaAmount: true },
          _count: { id: true }
        }),
        this.prisma.airdropQueue.groupBy({
          by: ['rewardType'],
          _sum: { ctaAmount: true },
          _count: { id: true }
        })
      ]);

      return {
        success: true,
        data: {
          total: {
            count: totalStats._count.id,
            amount: parseFloat(totalStats._sum.ctaAmount || '0')
          },
          byStatus: statusStats.map(stat => ({
            status: stat.status,
            count: stat._count.id,
            amount: parseFloat(stat._sum.ctaAmount || '0')
          })),
          byRewardType: rewardTypeStats.map(stat => ({
            rewardType: stat.rewardType,
            count: stat._count.id,
            amount: parseFloat(stat._sum.ctaAmount || '0')
          }))
        }
      };

    } catch (error) {
      console.error('에어드랍 통계 조회 오류:', error);
      return {
        success: false,
        error: 'STATS_FETCH_FAILED',
        message: '에어드랍 통계 조회 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 리소스 정리
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}