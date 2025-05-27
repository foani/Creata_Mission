import express from 'express';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
const router = express.Router();
const prisma = new PrismaClient();
const RANKING_CONFIG = {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100,
    MIN_SCORE: 1,
    AIRDROP_TOP_RANKS: 5,
    SUPPORTED_LANGUAGES: ['ko', 'en', 'vi', 'ja']
};
router.get('/', async (req, res) => {
    try {
        const { limit = RANKING_CONFIG.DEFAULT_LIMIT, offset = 0, language, gameType, verifiedOnly = 'true' } = req.query;
        const parsedLimit = Math.min(parseInt(limit?.toString() ?? `${RANKING_CONFIG.DEFAULT_LIMIT}`), RANKING_CONFIG.MAX_LIMIT);
        const parsedOffset = Math.max(parseInt(offset?.toString() ?? '0'), 0);
        if (language && !RANKING_CONFIG.SUPPORTED_LANGUAGES.includes(language)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_LANGUAGE',
                message: `지원되지 않는 언어입니다. 지원 언어: ${RANKING_CONFIG.SUPPORTED_LANGUAGES.join(', ')}`
            });
        }
        const whereCondition = {
            score: { gte: RANKING_CONFIG.MIN_SCORE },
            ...(verifiedOnly === 'true' && { isWalletVerified: true }),
            ...(language && { language })
        };
        let users;
        let totalCount;
        if (gameType) {
            const gameRankingQuery = `
        SELECT 
          u.wallet_address,
          u.language,
          u.created_at,
          u.last_played_at,
          COALESCE(SUM(gl.score), 0) as game_score,
          COUNT(gl.id) as game_count,
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(gl.score), 0) DESC) as rank
        FROM users u
        LEFT JOIN game_logs gl ON u.id = gl.user_id AND gl.game_type = $1
        WHERE u.score >= $2 
          ${verifiedOnly === 'true' ? 'AND u.is_wallet_verified = true' : ''}
          ${language ? 'AND u.language = $3' : ''}
        GROUP BY u.id, u.wallet_address, u.language, u.created_at, u.last_played_at
        ORDER BY game_score DESC
        LIMIT $${language ? '4' : '3'} OFFSET $${language ? '5' : '4'}
      `;
            const params = language ?
                [gameType, RANKING_CONFIG.MIN_SCORE, language, parsedLimit, parsedOffset] :
                [gameType, RANKING_CONFIG.MIN_SCORE, parsedLimit, parsedOffset];
            users = await prisma.$queryRawUnsafe(gameRankingQuery, ...params);
            const countQuery = `
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        LEFT JOIN game_logs gl ON u.id = gl.user_id AND gl.game_type = $1
        WHERE u.score >= $2
          ${verifiedOnly === 'true' ? 'AND u.is_wallet_verified = true' : ''}
          ${language ? 'AND u.language = $3' : ''}
      `;
            const countParams = language ? [gameType, RANKING_CONFIG.MIN_SCORE, language] : [gameType, RANKING_CONFIG.MIN_SCORE];
            const countResult = await prisma.$queryRawUnsafe(countQuery, ...countParams);
            totalCount = parseInt(countResult[0].total);
        }
        else {
            [users, totalCount] = await Promise.all([
                prisma.user.findMany({
                    where: whereCondition,
                    orderBy: { score: 'desc' },
                    take: parsedLimit,
                    skip: parsedOffset,
                    select: {
                        walletAddress: true,
                        score: true,
                        language: true,
                        createdAt: true,
                        lastPlayedAt: true,
                        _count: {
                            select: {
                                gameLogs: true
                            }
                        }
                    }
                }),
                prisma.user.count({ where: whereCondition })
            ]);
        }
        const formattedRanking = gameType ?
            users.map((user, index) => ({
                rank: parsedOffset + index + 1,
                walletAddress: user.wallet_address,
                score: parseInt(user.game_score),
                gameCount: parseInt(user.game_count),
                language: user.language,
                createdAt: user.created_at,
                lastPlayedAt: user.last_played_at
            })) :
            users.map((user, index) => ({
                rank: parsedOffset + index + 1,
                walletAddress: user.walletAddress,
                score: user.score,
                gameCount: user._count.gameLogs,
                language: user.language,
                createdAt: user.createdAt,
                lastPlayedAt: user.lastPlayedAt
            }));
        res.json({
            success: true,
            data: {
                ranking: formattedRanking,
                pagination: {
                    total: totalCount,
                    limit: parsedLimit,
                    offset: parsedOffset,
                    hasMore: totalCount > parsedOffset + parsedLimit
                },
                filters: {
                    language: language || 'all',
                    gameType: gameType || 'all',
                    verifiedOnly: verifiedOnly === 'true'
                },
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('랭킹 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: 'RANKING_FETCH_FAILED',
            message: '랭킹 조회 중 오류가 발생했습니다.'
        });
    }
});
router.get('/top/:count', async (req, res) => {
    try {
        const { count } = req.params;
        const { language } = req.query;
        const parsedCount = Math.min(Math.max(parseInt(count), 1), 20);
        if (isNaN(parsedCount)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_COUNT',
                message: '올바른 숫자를 입력해주세요. (1-20)'
            });
        }
        if (language && !RANKING_CONFIG.SUPPORTED_LANGUAGES.includes(language)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_LANGUAGE',
                message: `지원되지 않는 언어입니다. 지원 언어: ${RANKING_CONFIG.SUPPORTED_LANGUAGES.join(', ')}`
            });
        }
        const topUsers = await prisma.user.findMany({
            where: {
                isWalletVerified: true,
                score: { gte: RANKING_CONFIG.MIN_SCORE },
                ...(language && { language: language })
            },
            orderBy: { score: 'desc' },
            take: parsedCount,
            select: {
                walletAddress: true,
                score: true,
                language: true,
                createdAt: true,
                lastPlayedAt: true,
                _count: {
                    select: {
                        gameLogs: true
                    }
                }
            }
        });
        const topRanking = topUsers.map((user, index) => ({
            rank: index + 1,
            walletAddress: user.walletAddress,
            score: user.score,
            gameCount: user._count.gameLogs,
            language: user.language,
            isAirdropEligible: index < RANKING_CONFIG.AIRDROP_TOP_RANKS,
            createdAt: user.createdAt,
            lastPlayedAt: user.lastPlayedAt
        }));
        res.json({
            success: true,
            data: {
                ranking: topRanking,
                meta: {
                    requestedCount: parsedCount,
                    actualCount: topRanking.length,
                    language: language || 'all',
                    airdropEligibleCount: topRanking.filter(u => u.isAirdropEligible).length
                },
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('상위 랭킹 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: 'TOP_RANKING_FETCH_FAILED',
            message: '상위 랭킹 조회 중 오류가 발생했습니다.'
        });
    }
});
router.get('/user/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        if (!ethers.isAddress(walletAddress)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_WALLET_ADDRESS',
                message: '올바르지 않은 지갑 주소 형식입니다.'
            });
        }
        const user = await prisma.user.findUnique({
            where: { walletAddress: walletAddress.toLowerCase() },
            select: {
                walletAddress: true,
                score: true,
                language: true,
                isWalletVerified: true,
                createdAt: true,
                lastPlayedAt: true,
                _count: {
                    select: {
                        gameLogs: true
                    }
                }
            }
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'USER_NOT_FOUND',
                message: '등록되지 않은 사용자입니다.'
            });
        }
        const higherScoreCount = await prisma.user.count({
            where: {
                score: { gt: user.score },
                isWalletVerified: true
            }
        });
        const overallRank = higherScoreCount + 1;
        const languageRankCount = await prisma.user.count({
            where: {
                score: { gt: user.score },
                language: user.language,
                isWalletVerified: true
            }
        });
        const languageRank = languageRankCount + 1;
        const isAirdropEligible = overallRank <= RANKING_CONFIG.AIRDROP_TOP_RANKS;
        res.json({
            success: true,
            data: {
                user: {
                    walletAddress: user.walletAddress,
                    score: user.score,
                    language: user.language,
                    isWalletVerified: user.isWalletVerified,
                    gameCount: user._count.gameLogs,
                    createdAt: user.createdAt,
                    lastPlayedAt: user.lastPlayedAt
                },
                ranking: {
                    overall: overallRank,
                    byLanguage: languageRank,
                    isAirdropEligible,
                    airdropRankLimit: RANKING_CONFIG.AIRDROP_TOP_RANKS
                },
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('사용자 랭킹 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: 'USER_RANKING_FETCH_FAILED',
            message: '사용자 랭킹 조회 중 오류가 발생했습니다.'
        });
    }
});
router.use((error, req, res, next) => {
    console.error('RANKING API 오류:', error);
    res.status(500).json({
        success: false,
        error: error.name || 'RANKING_API_ERROR',
        message: error.message || 'RANKING API에서 오류가 발생했습니다.',
        timestamp: new Date().toISOString()
    });
});
export default router;
