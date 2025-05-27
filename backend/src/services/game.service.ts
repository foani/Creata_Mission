// backend/src/services/game.service.ts
// CreataChain 미션 게임 비즈니스 로직 서비스
import { Prisma, PrismaClient, User } from '@prisma/client'; // Prisma 네임스페이스 추가
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

// 환경변수에서 게임 설정 가져오기 - 하드코딩 제거
const GAME_TYPES = {
  CRYPTO: process.env.GAME_TYPE_CRYPTO || 'crypto', // 하드코딩된 게임 타입 - Crypto Price Prediction
  DERBY: process.env.GAME_TYPE_DERBY || 'derby', // 하드코딩된 게임 타입
  DARTS: process.env.GAME_TYPE_DARTS || 'darts' // 하드코딩된 게임 타입
} as const;

// parseInt 결과 검증 헬퍼 함수
const parseIntSafe = (value: string, defaultValue: number): number => {
  const parsed = parseInt(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

// 하드코딩된 게임별 점수 설정을 환경변수로 대체 - 런타임 오류 방지를 위해 함수로 구현
const getGameScores = () => {
  const cryptoType = GAME_TYPES.CRYPTO;
  const derbyType = GAME_TYPES.DERBY;
  const dartsType = GAME_TYPES.DARTS;
  
  return {
    [cryptoType]: {
      WIN: parseIntSafe(process.env.CRYPTO_WIN_SCORE || '100', 100), // 하드코딩된 Crypto Price Prediction 승리 점수
      LOSE: parseIntSafe(process.env.CRYPTO_LOSE_SCORE || '0', 0), // 하드코딩된 Crypto Price Prediction 패배 점수
      BONUS_STREAK: parseIntSafe(process.env.CRYPTO_BONUS_STREAK || '10', 10), // 하드코딩된 연속 보너스
      MAX_BONUS: parseIntSafe(process.env.CRYPTO_MAX_BONUS || '50', 50) // 하드코딩된 최대 보너스
    },
    [derbyType]: {
      WIN: parseIntSafe(process.env.DERBY_WIN_SCORE || '150', 150), // 하드코딩된 Lazy Derby 승리 점수
      LOSE: parseIntSafe(process.env.DERBY_LOSE_SCORE || '0', 0) // 하드코딩된 Lazy Derby 패배 점수
    },
    [dartsType]: {
      WIN: parseIntSafe(process.env.DARTS_WIN_SCORE || '200', 200), // 하드코딩된 Reverse Darts 승리 점수
      LOSE: parseIntSafe(process.env.DARTS_LOSE_SCORE || '0', 0) // 하드코딩된 Reverse Darts 패배 점수
    }
  };
};

// GAME_SCORES를 함수 호출로 가져오기 - 동적 키 문제 해결
const GAME_SCORES = getGameScores();

// 하드코딩된 점수 범위 설정을 환경변수로 대체
const SCORE_VALIDATION = {
  MIN: parseIntSafe(process.env.MIN_GAME_SCORE || '0', 0), // 하드코딩된 최소 점수
  MAX: parseIntSafe(process.env.MAX_GAME_SCORE || '1000', 1000) // 하드코딩된 최대 점수
};

// 게임별 결과 데이터 타입 정의 - any 타입 대신 구체적 타입 사용
export interface CryptoPricePredictionResult {
  prediction: 'up' | 'down';
  correct: boolean;
  actualPrice?: number;
  predictedPrice?: number;
}

export interface DerbyGameResult {
  selectedHorse: number;
  winningHorse: number;
  correct: boolean;
  raceTime?: number;
}

export interface DartsGameResult {
  survivalTime: number;
  targetTime: number;
  success: boolean;
  hitCount?: number;
}

export type GameResult = CryptoPricePredictionResult | DerbyGameResult | DartsGameResult;

// 게임 제출 요청 인터페이스 - result 타입 개선
export interface GameSubmissionRequest {
  walletAddress: string;
  gameType: string;
  score: number;
  round?: number;
  result: GameResult; // any 대신 구체적 타입 사용
  metadata?: Record<string, any>; // any 대신 Record 타입 사용
}

// 게임 제출 응답 인터페이스
export interface GameSubmissionResponse {
  success: boolean;
  gameLog?: {
    id: number;
    gameType: string;
    score: number;
    round: number;
    createdAt: Date;
  };
  user?: {
    id: string;
    walletAddress: string;
    totalScore: number;
    lastPlayedAt: Date;
  };
  error?: string;
  message?: string;
}

// 게임 기록 조회 요청 인터페이스
export interface GameHistoryRequest {
  walletAddress: string;
  gameType?: string;
  limit?: number;
  offset?: number;
}

// 게임 기록 항목에 대한 구체적인 타입 정의
interface GameLogHistoryEntry {
  id: number;
  gameType: string;
  round: number;
  score: number;
  result: Prisma.JsonValue; // Prisma.JsonValue 사용
  metadata: Prisma.JsonValue; // Prisma.JsonValue 사용
  createdAt: Date;
}
// 게임 기록 응답 인터페이스
export interface GameHistoryResponse {
  success: boolean;
  games?: GameLogHistoryEntry[]; // 구체적인 타입으로 변경
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  user?: {
    walletAddress: string;
    totalScore: number;
    lastPlayedAt: Date | null;
  };
  error?: string;
  message?: string;
}

export class GameService {
  private prisma: PrismaClient;
  
  constructor() {
    this.prisma = DatabaseManager.getInstance();
  }

  /**
   * 지갑 주소 형식 검증
   * @param walletAddress - 검증할 지갑 주소
   * @returns 유효하면 true, 아니면 false
   */
  private validateWalletAddress(walletAddress: string): boolean {
    return ethers.isAddress(walletAddress);
  }

  /**
   * 게임 타입 검증
   * @param gameType - 검증할 게임 타입
   * @returns 유효하면 true, 아니면 false
   */
  private validateGameType(gameType: string): boolean {
    return Object.values(GAME_TYPES).includes(gameType);
  }

  /**
   * 점수 범위 검증
   * @param score - 검증할 점수
   * @returns 유효하면 true, 아니면 false
   */
  private validateScore(score: number): boolean {
    return score >= SCORE_VALIDATION.MIN && score <= SCORE_VALIDATION.MAX;
  }

  /**
   * 게임 제출 데이터 전체 검증
   * @param request - 게임 제출 요청 데이터
   * @returns 검증 결과 및 에러 메시지
   */
  private validateGameSubmission(request: GameSubmissionRequest): { valid: boolean; error?: string; message?: string } {
    const { walletAddress, gameType, score, result } = request;

    // 필수 필드 검증
    if (!walletAddress || !gameType || score === undefined || !result) {
      return {
        valid: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: '지갑 주소, 게임 타입, 점수, 결과가 모두 필요합니다.'
      };
    }

    // 지갑 주소 형식 검증
    if (!this.validateWalletAddress(walletAddress)) {
      return {
        valid: false,
        error: 'INVALID_WALLET_ADDRESS',
        message: '올바르지 않은 지갑 주소 형식입니다.'
      };
    }

    // 게임 타입 검증
    if (!this.validateGameType(gameType)) {
      return {
        valid: false,
        error: 'INVALID_GAME_TYPE',
        message: `지원하지 않는 게임 타입입니다. 지원 타입: ${Object.values(GAME_TYPES).join(', ')}`
      };
    }

    // 점수 타입 검증
    if (typeof score !== 'number' || isNaN(score)) {
      return {
        valid: false,
        error: 'INVALID_SCORE_FORMAT',
        message: '점수는 숫자여야 합니다.'
      };
    }

    // 점수 범위 검증
    if (!this.validateScore(score)) {
      return {
        valid: false,
        error: 'INVALID_SCORE_RANGE',
        message: `점수는 ${SCORE_VALIDATION.MIN}에서 ${SCORE_VALIDATION.MAX} 사이여야 합니다.`
      };
    }

    return { valid: true };
  }

  /**
   * Crypto Price Prediction 연속 보너스 계산
   * @param userId - 사용자 ID
   * @param isWin - 현재 게임 승리 여부
   * @returns 보너스 점수
   */
  private async calculateCryptoBonus(userId: string, isWin: boolean): Promise<number> {
    if (!isWin) return 0;

    try {
      // 최근 Crypto Price Prediction 게임 기록 조회 (최대 10개)
      const recentGames = await this.prisma.gameLog.findMany({
        where: {
          userId,
          gameType: GAME_TYPES.CRYPTO
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { result: true }
      });

      // 연속 승리 계산
      let consecutiveWins = 1; // 현재 게임 포함
      for (const game of recentGames) {
        // 타입 안전성을 위한 결과 검증
        if (game.result && 
            typeof game.result === 'object' && 
            'correct' in game.result && 
            game.result.correct === true) {
          consecutiveWins++;
        } else {
          break;
        }
      }

      // 보너스 계산 (연속 승리 수 * 보너스 점수, 최대값 제한)
      const bonusScore = Math.min(
        (consecutiveWins - 1) * GAME_SCORES[GAME_TYPES.CRYPTO].BONUS_STREAK,
        GAME_SCORES[GAME_TYPES.CRYPTO].MAX_BONUS
      );

      return bonusScore;
    } catch (error) {
      console.error('Crypto 보너스 계산 오류:', error);
      return 0;
    }
  }

  /**
   * 게임 결과 제출 처리
   * @param request - 게임 제출 요청
   * @returns 제출 결과
   */
  async submitGame(request: GameSubmissionRequest): Promise<GameSubmissionResponse> {
    // 1. 입력값 검증
    const validation = this.validateGameSubmission(request);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        message: validation.message
      };
    }

    const { walletAddress, gameType, score, round, result, metadata } = request;

    try {
      // 2. 사용자 확인
      const user = await this.prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() }
      });

      if (!user) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: '등록되지 않은 사용자입니다. 먼저 지갑 인증을 진행해주세요.'
        };
      }

      // 3. 보너스 점수 계산 (Crypto Price Prediction만)
      let bonusScore = 0;
      if (gameType === GAME_TYPES.CRYPTO && 
          result && 
          'correct' in result && 
          result.correct === true) {
        bonusScore = await this.calculateCryptoBonus(user.id, true);
      }

      const finalScore = score + bonusScore;

      // 4. 트랜잭션으로 게임 로그 저장 및 사용자 점수 업데이트
      const [gameLog, updatedUser] = await this.prisma.$transaction(async (tx) => {
        // 게임 로그 생성
        const newGameLog = await tx.gameLog.create({
          data: {
            userId: user.id,
            gameType,
            round: round || Math.floor(Date.now() / 1000), // 하드코딩된 기본 라운드 (타임스탬프)를 환경변수로 개선 가능
            score: finalScore,
            result: result || {},
            metadata: metadata || {}
          }
        });

        // 사용자 점수 및 마지막 플레이 시간 업데이트
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            score: { increment: finalScore },
            lastPlayedAt: new Date()
          }
        });

        return [newGameLog, updatedUser];
      });

      console.log(`게임 제출 완료: ${walletAddress} - ${gameType} - ${finalScore}점 (보너스: ${bonusScore})`);

      return {
        success: true,
        gameLog: {
          id: gameLog.id,
          gameType: gameLog.gameType,
          score: gameLog.score,
          round: gameLog.round,
          createdAt: gameLog.createdAt
        },
        user: {
          id: updatedUser.id,
          walletAddress: updatedUser.walletAddress,
          totalScore: updatedUser.score,
          lastPlayedAt: updatedUser.lastPlayedAt || new Date()
        }
      };

    } catch (error) {
      console.error('게임 제출 오류:', error);
      return {
        success: false,
        error: 'GAME_SUBMISSION_FAILED',
        message: '게임 결과 저장 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 게임 기록 조회
   * @param request - 게임 기록 조회 요청
   * @returns 게임 기록 목록
   */
  async getGameHistory(request: GameHistoryRequest): Promise<GameHistoryResponse> {
    const { walletAddress, gameType, limit = 20, offset = 0 } = request;

    // 지갑 주소 검증
    if (!this.validateWalletAddress(walletAddress)) {
      return {
        success: false,
        error: 'INVALID_WALLET_ADDRESS',
        message: '올바르지 않은 지갑 주소 형식입니다.'
      };
    }

    try {
      // 사용자 확인
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

      // 게임 기록 조회 조건 설정
      const whereCondition = {
        userId: user.id,
        ...(gameType && { gameType })
      };

      // 전체 개수 조회
      const totalCount = await this.prisma.gameLog.count({
        where: whereCondition
      });

      // 게임 기록 조회
      const games = await this.prisma.gameLog.findMany({
        where: whereCondition,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          gameType: true,
          round: true,
          score: true,
          result: true,
          metadata: true,
          createdAt: true
        }
      });

      return {
        success: true,
        games,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: totalCount > offset + limit
        },
        user: {
          walletAddress: user.walletAddress,
          totalScore: user.score,
          lastPlayedAt: user.lastPlayedAt
        }
      };

    } catch (error) {
      console.error('게임 기록 조회 오류:', error);
      return {
        success: false,
        error: 'GAME_HISTORY_FETCH_FAILED',
        message: '게임 기록 조회 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 게임별 통계 조회
   * @param walletAddress - 사용자 지갑 주소
   * @returns 게임별 통계 정보
   */
  async getGameStats(walletAddress: string) {
    if (!this.validateWalletAddress(walletAddress)) {
      return {
        success: false,
        error: 'INVALID_WALLET_ADDRESS',
        message: '올바르지 않은 지갑 주소 형식입니다.'
      };
    }

    try {
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

      // 게임별 통계 계산
      const stats = await this.prisma.gameLog.groupBy({
        by: ['gameType'],
        where: { userId: user.id },
        _count: { id: true },
        _sum: { score: true },
        _avg: { score: true },
        _max: { score: true }
      });

      return {
        success: true,
        stats: stats.map(stat => ({
          gameType: stat.gameType,
          totalGames: stat._count.id,
          totalScore: stat._sum.score || 0,
          avgScore: Math.round(stat._avg.score || 0),
          maxScore: stat._max.score || 0
        })),
        user: {
          walletAddress: user.walletAddress,
          totalScore: user.score,
          lastPlayedAt: user.lastPlayedAt
        }
      };

    } catch (error) {
      console.error('게임 통계 조회 오류:', error);
      return {
        success: false,
        error: 'GAME_STATS_FETCH_FAILED',
        message: '게임 통계 조회 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 리소스 정리 (앱 종료 시 호출)
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}