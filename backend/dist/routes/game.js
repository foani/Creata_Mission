import express from 'express';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
const router = express.Router();
const prisma = new PrismaClient();
const GAME_TYPES = {
    BINARY: 'binary',
    DERBY: 'derby',
    DARTS: 'darts'
};
const GAME_SCORES = {
    [GAME_TYPES.BINARY]: {
        WIN: 100,
        LOSE: 0,
        BONUS_STREAK: 10,
        MAX_BONUS: 50
    },
    [GAME_TYPES.DERBY]: {
        WIN: 150,
        LOSE: 0
    },
    [GAME_TYPES.DARTS]: {
        WIN: 200,
        LOSE: 0
    }
};
function validateGameSubmission(req, res, next) {
    const { walletAddress, gameType, score, result } = req.body;
    if (!walletAddress || !gameType || score === undefined || !result) {
        return res.status(400).json({
            success: false,
            error: 'MISSING_REQUIRED_FIELDS',
            message: '누락된 필수 필드가 있습니다. (walletAddress, gameType, score, result)'
        });
    }
    if (!ethers.isAddress(walletAddress)) {
        return res.status(400).json({
            success: false,
            error: 'INVALID_WALLET_ADDRESS',
            message: '올바르지 않은 지갑 주소 형식입니다.'
        });
    }
    if (!Object.values(GAME_TYPES).includes(gameType)) {
        return res.status(400).json({
            success: false,
            error: 'INVALID_GAME_TYPE',
            message: `지원되지 않는 게임 타입입니다. 지원 타입: ${Object.values(GAME_TYPES).join(', ')}`
        });
    }
    if (score < 0 || score > 1000) {
        return res.status(400).json({
            success: false,
            error: 'INVALID_SCORE_RANGE',
            message: '점수는 0에서 1000 사이여야 합니다.'
        });
    }
    next();
}
router.post('/submit', validateGameSubmission, async (req, res) => {
    try {
        const { walletAddress, gameType, score, result, round } = req.body;
        const user = await prisma.user.findUnique({
            where: { walletAddress: walletAddress.toLowerCase() }
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'USER_NOT_FOUND',
                message: '등록되지 않은 사용자입니다. 먼저 지갑 인증을 진행해주세요.'
            });
        }
        if (!user.isWalletVerified) {
            return res.status(403).json({
                success: false,
                error: 'WALLET_NOT_VERIFIED',
                message: '지갑 인증이 필요합니다.'
            });
        }
        const [gameLog, updatedUser] = await prisma.$transaction([
            prisma.gameLog.create({
                data: {
                    userId: user.id,
                    gameType,
                    round: round || Math.floor(Date.now() / 1000),
                    score,
                    result: result || {}
                }
            }),
            prisma.user.update({
                where: { id: user.id },
                data: {
                    score: { increment: score },
                    lastPlayedAt: new Date()
                }
            })
        ]);
        res.json({
            success: true,
            message: '게임 결과가 성공적으로 저장되었습니다.',
            data: {
                gameLogId: gameLog.id,
                totalScore: updatedUser.score,
                scoreAdded: score,
                gameType,
                timestamp: gameLog.createdAt
            }
        });
    }
    catch (error) {
        console.error('게임 제출 오류:', error);
        res.status(500).json({
            success: false,
            error: 'GAME_SUBMISSION_FAILED',
            message: '게임 결과 저장 중 오류가 발생했습니다.'
        });
    }
});
router.get('/history/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const { gameType, limit = 10, offset = 0 } = req.query;
        if (!ethers.isAddress(walletAddress)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_WALLET_ADDRESS',
                message: '올바르지 않은 지갑 주소 형식입니다.'
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
        const gameTypeStr = typeof gameType === 'string' ? gameType : undefined;
        const whereCondition = {
            userId: user.id,
            ...(gameTypeStr && { gameType: gameTypeStr })
        };
        const [gameLogs, totalCount] = await Promise.all([
            prisma.gameLog.findMany({
                where: whereCondition,
                orderBy: { createdAt: 'desc' },
                take: Number(limit),
                skip: Number(offset),
                select: {
                    id: true,
                    gameType: true,
                    round: true,
                    score: true,
                    result: true,
                    createdAt: true
                }
            }),
            prisma.gameLog.count({
                where: whereCondition
            })
        ]);
        res.json({
            success: true,
            data: {
                gameLogs,
                pagination: {
                    total: totalCount,
                    limit: Number(limit),
                    offset: Number(offset),
                    hasMore: totalCount > Number(offset) + Number(limit)
                },
                user: {
                    walletAddress: user.walletAddress,
                    totalScore: user.score,
                    lastPlayedAt: user.lastPlayedAt
                }
            }
        });
    }
    catch (error) {
        console.error('게임 기록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: 'GAME_HISTORY_FETCH_FAILED',
            message: '게임 기록 조회 중 오류가 발생했습니다.'
        });
    }
});
router.get('/stats/:walletAddress', async (req, res) => {
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
            where: { walletAddress: walletAddress.toLowerCase() }
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'USER_NOT_FOUND',
                message: '등록되지 않은 사용자입니다.'
            });
        }
        const gameStats = await prisma.gameLog.groupBy({
            by: ['gameType'],
            where: { userId: user.id },
            _count: { gameType: true },
            _sum: { score: true },
            _avg: { score: true },
            _max: { score: true }
        });
        const totalStats = await prisma.gameLog.aggregate({
            where: { userId: user.id },
            _count: { id: true },
            _sum: { score: true },
            _avg: { score: true }
        });
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentStats = await prisma.gameLog.aggregate({
            where: {
                userId: user.id,
                createdAt: {
                    gte: sevenDaysAgo
                }
            },
            _count: { id: true },
            _sum: { score: true }
        });
        res.json({
            success: true,
            data: {
                user: {
                    walletAddress: user.walletAddress,
                    totalScore: user.score,
                    createdAt: user.createdAt,
                    lastPlayedAt: user.lastPlayedAt
                },
                totalStats: {
                    totalGames: totalStats._count.id || 0,
                    totalScore: totalStats._sum.score || 0,
                    averageScore: Math.round(totalStats._avg.score || 0)
                },
                gameTypeStats: gameStats.map(stat => ({
                    gameType: stat.gameType,
                    totalGames: stat._count.gameType,
                    totalScore: stat._sum.score || 0,
                    averageScore: Math.round(stat._avg.score || 0),
                    maxScore: stat._max.score || 0
                })),
                recentStats: {
                    last7Days: {
                        totalGames: recentStats._count.id || 0,
                        totalScore: recentStats._sum.score || 0
                    }
                }
            }
        });
    }
    catch (error) {
        console.error('게임 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: 'GAME_STATS_FETCH_FAILED',
            message: '게임 통계 조회 중 오류가 발생했습니다.'
        });
    }
});
router.get('/leaderboard', async (req, res) => {
    try {
        const { limit = 10, gameType } = req.query;
        const gameTypeStr = typeof gameType === 'string' ? gameType : undefined;
        const topUsers = await prisma.user.findMany({
            where: {
                isWalletVerified: true,
                score: { gt: 0 }
            },
            orderBy: { score: 'desc' },
            take: Number(limit),
            select: {
                walletAddress: true,
                score: true,
                language: true,
                lastPlayedAt: true,
                _count: {
                    select: {
                        gameLogs: gameTypeStr ? { where: { gameType: gameTypeStr } } : true
                    }
                }
            }
        });
        const leaderboard = topUsers.map((user, index) => ({
            rank: index + 1,
            walletAddress: user.walletAddress,
            score: user.score,
            language: user.language,
            totalGames: user._count?.gameLogs ?? 0,
            lastPlayedAt: user.lastPlayedAt
        }));
        res.json({
            success: true,
            data: {
                leaderboard,
                filter: gameTypeStr || 'all',
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('리더보드 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: 'LEADERBOARD_FETCH_FAILED',
            message: '리더보드 조회 중 오류가 발생했습니다.'
        });
    }
});
router.get('/types', (req, res) => {
    res.json({
        success: true,
        data: {
            gameTypes: Object.entries(GAME_TYPES).map(([key, value]) => ({
                key,
                value,
                name: {
                    ko: key === 'BINARY' ? '바이너리 옵션' :
                        key === 'DERBY' ? '레이지 더비' : '리버스 다트',
                    en: key === 'BINARY' ? 'Binary Options' :
                        key === 'DERBY' ? 'Lazy Derby' : 'Reverse Darts',
                    vi: key === 'BINARY' ? 'Tùy chọn nhị phân' :
                        key === 'DERBY' ? 'Derby lười' : 'Phi tiêu ngược',
                    ja: key === 'BINARY' ? 'バイナリーオプション' :
                        key === 'DERBY' ? 'レイジーダービー' : 'リバースダーツ'
                },
                scores: GAME_SCORES[value]
            })),
            supportedLanguages: ['ko', 'en', 'vi', 'ja'],
            maxScoreLimit: 1000,
            apiVersion: '1.0.0'
        }
    });
});
router.use((error, req, res, next) => {
    console.error('게임 API 오류:', error);
    if (error.code && typeof error.code === 'string' && error.code.startsWith('P')) {
        return res.status(400).json({
            success: false,
            error: 'DATABASE_ERROR',
            message: '데이터베이스 오류가 발생했습니다.',
            code: error.code
        });
    }
    res.status(error.status || 500).json({
        success: false,
        error: error.name || 'GAME_API_ERROR',
        message: error.message || '게임 API에서 오류가 발생했습니다.',
        timestamp: new Date().toISOString()
    });
});
export default router;
