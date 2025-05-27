import { PrismaClient, Prisma } from '@prisma/client';
class DatabaseManager {
    static instance;
    static getInstance() {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new PrismaClient();
        }
        return DatabaseManager.instance;
    }
}
const safeParseInt = (value, defaultValue) => {
    if (value === undefined)
        return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};
const RANKING_CONFIG = {
    DEFAULT_LIMIT: safeParseInt(process.env.RANKING_DEFAULT_LIMIT, 20),
    MAX_LIMIT: safeParseInt(process.env.RANKING_MAX_LIMIT, 100),
    MIN_SCORE: safeParseInt(process.env.RANKING_MIN_SCORE, 1),
    AIRDROP_TOP_RANKS: safeParseInt(process.env.AIRDROP_TOP_RANKS, 5),
    SUPPORTED_LANGUAGES: (process.env.SUPPORTED_LANGUAGES || 'ko,en,vi,ja').split(','),
    CACHE_TTL: safeParseInt(process.env.RANKING_CACHE_TTL, 300),
    MAX_CONCURRENT_QUERIES: safeParseInt(process.env.MAX_CONCURRENT_QUERIES, 10)
};
class MemoryCache {
    cache = new Map();
    set(key, data, ttl = RANKING_CONFIG.CACHE_TTL) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttl * 1000
        });
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    clear() {
        this.cache.clear();
    }
    getKeys() {
        return this.cache.keys();
    }
    delete(key) {
        return this.cache.delete(key);
    }
}
export class RankingService {
    prisma;
    cache = new MemoryCache();
    activeQueries = new Set();
    constructor() {
        this.prisma = DatabaseManager.getInstance();
    }
    validateInput(limit, offset, language) {
        let parsedLimit = parseInt(String(limit ?? RANKING_CONFIG.DEFAULT_LIMIT), 10);
        if (isNaN(parsedLimit)) {
            parsedLimit = RANKING_CONFIG.DEFAULT_LIMIT;
        }
        const validatedLimit = Math.min(Math.max(parsedLimit, 1), RANKING_CONFIG.MAX_LIMIT);
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
    async withConcurrencyLimit(key, operation) {
        if (this.activeQueries.size >= RANKING_CONFIG.MAX_CONCURRENT_QUERIES) {
            throw new Error('서버가 바쁩니다. 잠시 후 다시 시도해주세요.');
        }
        this.activeQueries.add(key);
        try {
            return await operation();
        }
        finally {
            this.activeQueries.delete(key);
        }
    }
    async getRanking(request) {
        const { gameType, language, verifiedOnly = true } = request;
        const validation = this.validateInput(request.limit, request.offset, language);
        if (!validation.valid) {
            return {
                success: false,
                error: 'INVALID_INPUT',
                message: validation.error
            };
        }
        const { limit, offset } = validation;
        const cacheKey = `ranking:${gameType || 'all'}:${language || 'all'}:${verifiedOnly}:${limit}:${offset}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return {
                ...cached,
                cached: true
            };
        }
        try {
            return await this.withConcurrencyLimit(cacheKey, async () => {
                let ranking;
                let total;
                if (gameType) {
                    const result = await this.getGameSpecificRanking(gameType, language, verifiedOnly, limit, offset);
                    ranking = result.ranking;
                    total = result.total;
                }
                else {
                    const result = await this.getOverallRanking(language, verifiedOnly, limit, offset);
                    ranking = result.ranking;
                    total = result.total;
                }
                const response = {
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
                this.cache.set(cacheKey, response);
                return response;
            });
        }
        catch (error) {
            console.error('랭킹 조회 오류:', error);
            return {
                success: false,
                error: 'RANKING_FETCH_FAILED',
                message: '랭킹 조회 중 오류가 발생했습니다.'
            };
        }
    }
    async getOverallRanking(language, verifiedOnly = true, limit = 20, offset = 0) {
        const whereCondition = {
            score: { gte: RANKING_CONFIG.MIN_SCORE }
        };
        if (verifiedOnly)
            whereCondition.isWalletVerified = true;
        if (language)
            whereCondition.language = language;
        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where: whereCondition,
                orderBy: [
                    { score: 'desc' },
                    { createdAt: 'asc' }
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
        const ranking = users.map((user, index) => ({
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
    async getGameSpecificRanking(gameType, language, verifiedOnly = true, limit = 20, offset = 0) {
        const whereConditions = [];
        if (verifiedOnly) {
            whereConditions.push(Prisma.sql `u.is_wallet_verified = true`);
        }
        if (language) {
            whereConditions.push(Prisma.sql `u.language = ${language}`);
        }
        const whereClause = whereConditions.length > 0 ? Prisma.sql `AND ${Prisma.join(whereConditions, ' AND ')}` : Prisma.empty;
        const baseQuery = Prisma.sql `
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
        const countWhereConditions = [];
        if (verifiedOnly) {
            countWhereConditions.push(Prisma.sql `u.is_wallet_verified = true`);
        }
        if (language) {
            countWhereConditions.push(Prisma.sql `u.language = ${language}`);
        }
        const countWhereClause = countWhereConditions.length > 0 ? Prisma.sql `AND ${Prisma.join(countWhereConditions, ' AND ')}` : Prisma.empty;
        const countQuery = Prisma.sql `
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
        const [rankingData, countData] = await Promise.all([
            this.prisma.$queryRaw(baseQuery),
            this.prisma.$queryRaw(countQuery)
        ]);
        const ranking = rankingData.map((user) => ({
            rank: Number(user.rank),
            walletAddress: user.wallet_address,
            score: Number(user.game_score),
            gameCount: Number(user.game_count),
            language: user.language,
            isAirdropEligible: Number(user.rank) <= RANKING_CONFIG.AIRDROP_TOP_RANKS,
            createdAt: user.created_at,
            lastPlayedAt: user.last_played_at
        }));
        const total = Number(countData[0]?.total || 0n);
        return { ranking, total };
    }
    async getTopRanking(request) {
        const { count = 10, language, verifiedOnly = true } = request;
        const validatedCount = Math.min(Math.max(count, 1), 20);
        const cacheKey = `top-ranking:${validatedCount}:${language || 'all'}:${verifiedOnly}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return { ...cached, cached: true };
        }
        try {
            const whereCondition = {
                score: { gte: RANKING_CONFIG.MIN_SCORE }
            };
            if (verifiedOnly)
                whereCondition.isWalletVerified = true;
            if (language)
                whereCondition.language = language;
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
            const topRanking = topUsers.map((user, index) => ({
                rank: index + 1,
                walletAddress: user.walletAddress,
                score: user.score,
                gameCount: user._count.gameLogs,
                language: user.language,
                isAirdropEligible: (index + 1) <= RANKING_CONFIG.AIRDROP_TOP_RANKS,
                createdAt: user.createdAt,
                lastPlayedAt: user.lastPlayedAt
            }));
            const response = {
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
        }
        catch (error) {
            console.error('상위 랭킹 조회 오류:', error);
            return {
                success: false,
                error: 'TOP_RANKING_FETCH_FAILED',
                message: '상위 랭킹 조회 중 오류가 발생했습니다.'
            };
        }
    }
    async getUserRanking(walletAddress) {
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
            const [{ overall_rank, language_rank }] = await this.prisma.$queryRaw `
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
            this.cache.set(cacheKey, result, 60);
            return result;
        }
        catch (error) {
            console.error('개인 랭킹 조회 오류:', error);
            return {
                success: false,
                error: 'USER_RANKING_FETCH_FAILED',
                message: '개인 랭킹 조회 중 오류가 발생했습니다.'
            };
        }
    }
    invalidateCache(patterns) {
        if (patterns) {
            for (const key of this.cache.getKeys()) {
                if (patterns.some(pattern => key.includes(pattern))) {
                    this.cache.delete(key);
                }
            }
        }
        else {
            this.cache.clear();
        }
    }
    async disconnect() {
        this.cache.clear();
        await this.prisma.$disconnect();
    }
}
