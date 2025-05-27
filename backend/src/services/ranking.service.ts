// backend/src/services/ranking.service.ts
// 실전급 랭킹 서비스 - 대용량 데이터 및 고성능 처리 지원
import { PrismaClient, Prisma } from '@prisma/client'; // Prisma 추가

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
const safeParseInt = (value: string | undefined, defaultValue: number): number => {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// 환경변수에서 랭킹 설정 가져오기
const RANKING_CONFIG = {
  DEFAULT_LIMIT: safeParseInt(process.env.RANKING_DEFAULT_LIMIT, 20),
  MAX_LIMIT: safeParseInt(process.env.RANKING_MAX_LIMIT, 100),
  MIN_SCORE: safeParseInt(process.env.RANKING_MIN_SCORE, 1),
  AIRDROP_TOP_RANKS: safeParseInt(process.env.AIRDROP_TOP_RANKS, 5),
  SUPPORTED_LANGUAGES: (process.env.SUPPORTED_LANGUAGES || 'ko,en,vi,ja').split(','),
  CACHE_TTL: safeParseInt(process.env.RANKING_CACHE_TTL, 300), // 5분 캐시
  MAX_CONCURRENT_QUERIES: safeParseInt(process.env.MAX_CONCURRENT_QUERIES, 10)
};

// 랭킹 요청 인터페이스
export interface RankingRequest {
  limit?: number;
  offset?: number;
  language?: string;
  gameType?: string;
  verifiedOnly?: boolean;
}

// 랭킹 사용자 정보 인터페이스
export interface RankingUser {
  rank: number;
  walletAddress: string;
  score: number;
  gameCount: number;
  language: string;
  isAirdropEligible: boolean;
  createdAt: Date;
  lastPlayedAt: Date | null;
}

// 랭킹 응답 인터페이스
export interface RankingResponse {
  success: boolean;
  ranking?: RankingUser[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  filters?: {
    language: string;
    gameType: string;
    verifiedOnly: boolean;
  };
  cached?: boolean;
  error?: string;
  message?: string;
}

// 상위 랭킹 요청 인터페이스
export interface TopRankingRequest {
  count?: number;
  language?: string;
  verifiedOnly?: boolean;
}

// 상위 랭킹 응답 인터페이스
export interface TopRankingResponse {
  success: boolean;
  topRanking?: RankingUser[];
  airdropEligible?: RankingUser[];
  summary?: {
    totalUsers: number;
    averageScore: number;
    topScore: number;
    activeLanguages: string[];
  };
  cached?: boolean;
  error?: string;
  message?: string;
}

// 메모리 캐시 (실제 서비스에서는 Redis 사용 권장)
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  
  set(key: string, data: any, ttl: number = RANKING_CONFIG.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl * 1000 // 초를 밀리초로 변환
    });
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  clear(): void {
    this.cache.clear();
  }

  public getKeys(): IterableIterator<string> {
    return this.cache.keys();
  }

  public delete(key: string): boolean {
    return this.cache.delete(key);
  }
}

export class RankingService {
  private prisma: PrismaClient;
  private cache = new MemoryCache();
  private activeQueries = new Set<string>();
  
  constructor() {
    this.prisma = DatabaseManager.getInstance();
  }

  /**
   * 입력값 안전 검증
   */
  private validateInput(limit?: number, offset?: number, language?: string): {
    valid: boolean;
    limit: number;
    offset: number;
    error?: string;
  } {
    let parsedLimit = parseInt(String(limit ?? RANKING_CONFIG.DEFAULT_LIMIT), 10);
    if (isNaN(parsedLimit)) {
      parsedLimit = RANKING_CONFIG.DEFAULT_LIMIT;
    }
    const validatedLimit = Math.min(
      Math.max(parsedLimit, 1),
      RANKING_CONFIG.MAX_LIMIT
    );

    let parsedOffset = parseInt(String(offset ?? 0), 10);
    if (isNaN(parsedOffset)) {
      parsedOffset = 0;
    }
    const validatedOffset = Math.max(parsedOffset, 0);
    if (language && !RANKING_CONFIG.SUPPORTED_LANGUAGES.includes(language)) {
      return {
        valid: false,
        limit: validatedLimit,
        offset: validatedOffset,
        error: `지원하지 않는 언어입니다. 지원 언어: ${RANKING_CONFIG.SUPPORTED_LANGUAGES.join(', ')}`
      };
    }
    
    return {
      valid: true,
      limit: validatedLimit,
      offset: validatedOffset
    };
  }

  /**
   * 동시 쿼리 제한 (DoS 방지)
   */
  private async withConcurrencyLimit<T>(key: string, operation: () => Promise<T>): Promise<T> {
    if (this.activeQueries.size >= RANKING_CONFIG.MAX_CONCURRENT_QUERIES) {
      throw new Error('서버가 바쁩니다. 잠시 후 다시 시도해주세요.');
    }
    
    this.activeQueries.add(key);
    try {
      return await operation();
    } finally {
      this.activeQueries.delete(key);
    }
  }

  /**
   * 실전급 전체 랭킹 조회 - DB 최적화 및 캐싱 적용
   */
  async getRanking(request: RankingRequest): Promise<RankingResponse> {
    const { gameType, language, verifiedOnly = true } = request;
    
    // 입력값 검증
    const validation = this.validateInput(request.limit, request.offset, language);
    if (!validation.valid) {
      return {
        success: false,
        error: 'INVALID_INPUT',
        message: validation.error
      };
    }
    
    const { limit, offset } = validation;
    
    // 캐시 키 생성
    const cacheKey = `ranking:${gameType || 'all'}:${language || 'all'}:${verifiedOnly}:${limit}:${offset}`;
    
    // 캐시 확인
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        cached: true
      };
    }

    try {
      return await this.withConcurrencyLimit(cacheKey, async () => {
        let ranking: RankingUser[];
        let total: number;

        if (gameType) {
          // 게임별 랭킹 - DB 레벨 최적화
          const result = await this.getGameSpecificRanking(gameType, language, verifiedOnly, limit, offset);
          ranking = result.ranking;
          total = result.total;
        } else {
          // 전체 랭킹 - 인덱스 최적화 쿼리
          const result = await this.getOverallRanking(language, verifiedOnly, limit, offset);
          ranking = result.ranking;
          total = result.total;
        }

        const response: RankingResponse = {
          success: true,
          ranking,
          pagination: {
            total,
            limit,
            offset,
            hasMore: total > offset + limit
          },
          filters: {
            language: language || 'all',
            gameType: gameType || 'all',
            verifiedOnly
          },
          cached: false
        };

        // 결과 캐싱
        this.cache.set(cacheKey, response);
        
        return response;
      });

    } catch (error) {
      console.error('랭킹 조회 오류:', error);
      return {
        success: false,
        error: 'RANKING_FETCH_FAILED',
        message: '랭킹 조회 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 전체 랭킹 조회 - 최적화된 단일 쿼리
   */
  private async getOverallRanking(language?: string, verifiedOnly = true, limit = 20, offset = 0) {
    const whereCondition: any = {
      score: { gte: RANKING_CONFIG.MIN_SCORE }
    };
    
    if (verifiedOnly) whereCondition.isWalletVerified = true;
    if (language) whereCondition.language = language;

    // 병렬로 데이터와 총 개수 조회
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereCondition,
        orderBy: [
          { score: 'desc' },
          { createdAt: 'asc' } // 동점자 처리: 먼저 가입한 사용자가 높은 순위
        ],
        take: limit,
        skip: offset,
        select: {
          walletAddress: true,
          score: true,
          language: true,
          createdAt: true,
          lastPlayedAt: true,
          _count: {
            select: { gameLogs: true }
          }
        }
      }),
      this.prisma.user.count({ where: whereCondition })
    ]);

    const ranking: RankingUser[] = users.map((user, index) => ({
      rank: offset + index + 1,
      walletAddress: user.walletAddress,
      score: user.score,
      gameCount: user._count.gameLogs,
      language: user.language,
      isAirdropEligible: (offset + index + 1) <= RANKING_CONFIG.AIRDROP_TOP_RANKS,
      createdAt: user.createdAt,
      lastPlayedAt: user.lastPlayedAt
    }));

    return { ranking, total };
  }

  /**
   * 게임별 랭킹 조회 - DB 집계 함수 활용
   */
  private async getGameSpecificRanking(gameType: string, language?: string, verifiedOnly = true, limit = 20, offset = 0) {
    const whereConditions: Prisma.Sql[] = [];
    if (verifiedOnly) {
      whereConditions.push(Prisma.sql`u.is_wallet_verified = true`);
    }
    if (language) {
      whereConditions.push(Prisma.sql`u.language = ${language}`);
    }
    const whereClause = whereConditions.length > 0 ? Prisma.sql`AND ${Prisma.join(whereConditions, ' AND ')}` : Prisma.empty;

    const baseQuery = Prisma.sql`
      SELECT 
        u.wallet_address,
        u.language,
        u.created_at,
        u.last_played_at,
        COALESCE(SUM(gl.score), 0)::integer as game_score, -- Ensure integer type if appropriate
        COUNT(gl.id)::integer as game_count, -- Ensure integer type
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(gl.score), 0) DESC, u.created_at ASC)::integer as rank -- Ensure integer type
      FROM users u
      LEFT JOIN game_logs gl ON u.id = gl.user_id AND gl.game_type = ${gameType}
      WHERE u.score >= ${RANKING_CONFIG.MIN_SCORE}
        ${whereClause}
      GROUP BY u.id, u.wallet_address, u.language, u.created_at, u.last_played_at
      HAVING COALESCE(SUM(gl.score), 0) > 0
      ORDER BY game_score DESC, u.created_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Count query where conditions
    const countWhereConditions: Prisma.Sql[] = [];
    if (verifiedOnly) {
      countWhereConditions.push(Prisma.sql`u.is_wallet_verified = true`);
    }
    if (language) {
      countWhereConditions.push(Prisma.sql`u.language = ${language}`);
    }
    const countWhereClause = countWhereConditions.length > 0 ? Prisma.sql`AND ${Prisma.join(countWhereConditions, ' AND ')}` : Prisma.empty;

    const countQuery = Prisma.sql`
      SELECT COUNT(*) as total
      FROM (
        SELECT u.id
        FROM users u
        LEFT JOIN game_logs gl ON u.id = gl.user_id AND gl.game_type = ${gameType}
        WHERE u.score >= ${RANKING_CONFIG.MIN_SCORE}
          ${countWhereClause}
        GROUP BY u.id
        HAVING COALESCE(SUM(gl.score), 0) > 0
      ) as filtered_users
    `;

    // 병렬로 데이터와 총 개수 조회
    const [rankingData, countData] = await Promise.all([
      this.prisma.$queryRaw(baseQuery),
      this.prisma.$queryRaw(countQuery)
    ]);

    // Prisma $queryRaw can return BigInt for counts/sums, ensure proper conversion
    const ranking: RankingUser[] = (rankingData as any[]).map((user: {
      rank: number | bigint; // ROW_NUMBER() might be BigInt
      wallet_address: string;
      game_score: number | bigint; // SUM() might be BigInt or Decimal
      game_count: number | bigint; // COUNT() might be BigInt
      language: string;
      created_at: Date;
      last_played_at: Date | null;
    }) => ({
      rank: Number(user.rank),
      walletAddress: user.wallet_address,
      score: Number(user.game_score),
      gameCount: Number(user.game_count),
      language: user.language,
      isAirdropEligible: Number(user.rank) <= RANKING_CONFIG.AIRDROP_TOP_RANKS,
      createdAt: user.created_at,
      lastPlayedAt: user.last_played_at
    }));

    const total = Number((countData as any)[0]?.total || 0n); // COUNT(*) returns BigInt

    return { ranking, total };
  }

  /**
   * 상위 랭킹 조회 - 캐싱 최적화
   */
  async getTopRanking(request: TopRankingRequest): Promise<TopRankingResponse> {
    const { count = 10, language, verifiedOnly = true } = request;
    
    const validatedCount = Math.min(Math.max(count, 1), 20);
    
    const cacheKey = `top-ranking:${validatedCount}:${language || 'all'}:${verifiedOnly}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    try {
      const whereCondition: any = {
        score: { gte: RANKING_CONFIG.MIN_SCORE }
      };
      
      if (verifiedOnly) whereCondition.isWalletVerified = true;
      if (language) whereCondition.language = language;

      const [topUsers, totalUsers, avgScore, languageStats] = await Promise.all([
        this.prisma.user.findMany({
          where: whereCondition,
          orderBy: [
            { score: 'desc' },
            { createdAt: 'asc' }
          ],
          take: validatedCount,
          select: {
            walletAddress: true,
            score: true,
            language: true,
            createdAt: true,
            lastPlayedAt: true,
            _count: { select: { gameLogs: true } }
          }
        }),
        this.prisma.user.count({ where: whereCondition }),
        this.prisma.user.aggregate({
          where: whereCondition,
          _avg: { score: true }
        }),
        this.prisma.user.groupBy({
          by: ['language'],
          where: whereCondition,
          _count: { language: true }
        })
      ]);

      const topRanking: RankingUser[] = topUsers.map((user, index) => ({
        rank: index + 1,
        walletAddress: user.walletAddress,
        score: user.score,
        gameCount: user._count.gameLogs,
        language: user.language,
        isAirdropEligible: (index + 1) <= RANKING_CONFIG.AIRDROP_TOP_RANKS,
        createdAt: user.createdAt,
        lastPlayedAt: user.lastPlayedAt
      }));

      const response: TopRankingResponse = {
        success: true,
        topRanking,
        airdropEligible: topRanking.filter(user => user.isAirdropEligible),
        summary: {
          totalUsers,
          averageScore: Math.round(avgScore._avg.score || 0),
          topScore: topUsers[0]?.score || 0,
          activeLanguages: languageStats.map(stat => stat.language)
        },
        cached: false
      };

      this.cache.set(cacheKey, response);
      return response;

    } catch (error) {
      console.error('상위 랭킹 조회 오류:', error);
      return {
        success: false,
        error: 'TOP_RANKING_FETCH_FAILED',
        message: '상위 랭킹 조회 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 개인 랭킹 조회 - 효율적인 단일 쿼리
   */
  async getUserRanking(walletAddress: string) {
    const cacheKey = `user-ranking:${walletAddress.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
        select: {
          id: true,
          walletAddress: true,
          score: true,
          language: true,
          createdAt: true,
          lastPlayedAt: true,
          _count: { select: { gameLogs: true } }
        }
      });

      if (!user) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: '등록되지 않은 사용자입니다.'
        };
      }

      // 효율적인 랭킹 계산 - 단일 쿼리
      const [{ overall_rank, language_rank }] = await this.prisma.$queryRaw<Array<{overall_rank: bigint, language_rank: bigint}>>`
        SELECT 
          (SELECT COUNT(*) + 1 FROM users WHERE score > ${user.score} AND is_wallet_verified = true) as overall_rank,
          (SELECT COUNT(*) + 1 FROM users WHERE score > ${user.score} AND language = ${user.language} AND is_wallet_verified = true) as language_rank
      `;

      const result = {
        success: true,
        userRanking: {
          rank: Number(overall_rank),
          languageRank: Number(language_rank),
          walletAddress: user.walletAddress,
          score: user.score,
          gameCount: user._count.gameLogs,
          language: user.language,
          isAirdropEligible: Number(overall_rank) <= RANKING_CONFIG.AIRDROP_TOP_RANKS,
          createdAt: user.createdAt,
          lastPlayedAt: user.lastPlayedAt
        }
      };

      this.cache.set(cacheKey, result, 60); // 1분 캐시 (개인 랭킹은 짧게)
      return result;

    } catch (error) {
      console.error('개인 랭킹 조회 오류:', error);
      return {
        success: false,
        error: 'USER_RANKING_FETCH_FAILED',
        message: '개인 랭킹 조회 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 캐시 무효화 (게임 결과 업데이트 시 호출)
   */
  invalidateCache(patterns?: string[]): void {
    if (patterns) {
      // 특정 패턴만 무효화
      for (const key of this.cache.getKeys()) { // Use public getter
        if (patterns.some(pattern => key.includes(pattern))) {
          this.cache.delete(key); // Use public method
        }
      }
    } else {
      // 전체 캐시 무효화
      this.cache.clear();
    }
  }

  /**
   * 리소스 정리
   */
  async disconnect() {
    this.cache.clear();
    await this.prisma.$disconnect();
  }
}