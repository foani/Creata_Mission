import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
class DatabaseManager {
    static instance;
    static getInstance() {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new PrismaClient();
        }
        return DatabaseManager.instance;
    }
}
const GAME_TYPES = {
    CRYPTO: process.env.GAME_TYPE_CRYPTO || 'crypto',
    DERBY: process.env.GAME_TYPE_DERBY || 'derby',
    DARTS: process.env.GAME_TYPE_DARTS || 'darts'
};
const parseIntSafe = (value, defaultValue) => {
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
};
const getGameScores = () => {
    const cryptoType = GAME_TYPES.CRYPTO;
    const derbyType = GAME_TYPES.DERBY;
    const dartsType = GAME_TYPES.DARTS;
    return {
        [cryptoType]: {
            WIN: parseIntSafe(process.env.CRYPTO_WIN_SCORE || '100', 100),
            LOSE: parseIntSafe(process.env.CRYPTO_LOSE_SCORE || '0', 0),
            BONUS_STREAK: parseIntSafe(process.env.CRYPTO_BONUS_STREAK || '10', 10),
            MAX_BONUS: parseIntSafe(process.env.CRYPTO_MAX_BONUS || '50', 50)
        },
        [derbyType]: {
            WIN: parseIntSafe(process.env.DERBY_WIN_SCORE || '150', 150),
            LOSE: parseIntSafe(process.env.DERBY_LOSE_SCORE || '0', 0)
        },
        [dartsType]: {
            WIN: parseIntSafe(process.env.DARTS_WIN_SCORE || '200', 200),
            LOSE: parseIntSafe(process.env.DARTS_LOSE_SCORE || '0', 0)
        }
    };
};
const GAME_SCORES = getGameScores();
const SCORE_VALIDATION = {
    MIN: parseIntSafe(process.env.MIN_GAME_SCORE || '0', 0),
    MAX: parseIntSafe(process.env.MAX_GAME_SCORE || '1000', 1000)
};
export class GameService {
    prisma;
    constructor() {
        this.prisma = DatabaseManager.getInstance();
    }
    validateWalletAddress(walletAddress) {
        return ethers.isAddress(walletAddress);
    }
    validateGameType(gameType) {
        return Object.values(GAME_TYPES).includes(gameType);
    }
    validateScore(score) {
        return score >= SCORE_VALIDATION.MIN && score <= SCORE_VALIDATION.MAX;
    }
    validateGameSubmission(request) {
        const { walletAddress, gameType, score, result } = request;
        if (!walletAddress || !gameType || score === undefined || !result) {
            return {
                valid: false,
                error: 'MISSING_REQUIRED_FIELDS',
                message: '지갑 주소, 게임 타입, 점수, 결과가 모두 필요합니다.'
            };
        }
        if (!this.validateWalletAddress(walletAddress)) {
            return {
                valid: false,
                error: 'INVALID_WALLET_ADDRESS',
                message: '올바르지 않은 지갑 주소 형식입니다.'
            };
        }
        if (!this.validateGameType(gameType)) {
            return {
                valid: false,
                error: 'INVALID_GAME_TYPE',
                message: `지원하지 않는 게임 타입입니다. 지원 타입: ${Object.values(GAME_TYPES).join(', ')}`
            };
        }
        if (typeof score !== 'number' || isNaN(score)) {
            return {
                valid: false,
                error: 'INVALID_SCORE_FORMAT',
                message: '점수는 숫자여야 합니다.'
            };
        }
        if (!this.validateScore(score)) {
            return {
                valid: false,
                error: 'INVALID_SCORE_RANGE',
                message: `점수는 ${SCORE_VALIDATION.MIN}에서 ${SCORE_VALIDATION.MAX} 사이여야 합니다.`
            };
        }
        return { valid: true };
    }
    async calculateCryptoBonus(userId, isWin) {
        if (!isWin)
            return 0;
        try {
            const recentGames = await this.prisma.gameLog.findMany({
                where: {
                    userId,
                    gameType: GAME_TYPES.CRYPTO
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: { result: true }
            });
            let consecutiveWins = 1;
            for (const game of recentGames) {
                if (game.result &&
                    typeof game.result === 'object' &&
                    'correct' in game.result &&
                    game.result.correct === true) {
                    consecutiveWins++;
                }
                else {
                    break;
                }
            }
            const bonusScore = Math.min((consecutiveWins - 1) * GAME_SCORES[GAME_TYPES.CRYPTO].BONUS_STREAK, GAME_SCORES[GAME_TYPES.CRYPTO].MAX_BONUS);
            return bonusScore;
        }
        catch (error) {
            console.error('Crypto 보너스 계산 오류:', error);
            return 0;
        }
    }
    async submitGame(request) {
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
            let bonusScore = 0;
            if (gameType === GAME_TYPES.CRYPTO &&
                result &&
                'correct' in result &&
                result.correct === true) {
                bonusScore = await this.calculateCryptoBonus(user.id, true);
            }
            const finalScore = score + bonusScore;
            const [gameLog, updatedUser] = await this.prisma.$transaction(async (tx) => {
                const newGameLog = await tx.gameLog.create({
                    data: {
                        userId: user.id,
                        gameType,
                        round: round || Math.floor(Date.now() / 1000),
                        score: finalScore,
                        result: result || {},
                        metadata: metadata || {}
                    }
                });
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
        }
        catch (error) {
            console.error('게임 제출 오류:', error);
            return {
                success: false,
                error: 'GAME_SUBMISSION_FAILED',
                message: '게임 결과 저장 중 오류가 발생했습니다.'
            };
        }
    }
    async getGameHistory(request) {
        const { walletAddress, gameType, limit = 20, offset = 0 } = request;
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
            const whereCondition = {
                userId: user.id,
                ...(gameType && { gameType })
            };
            const totalCount = await this.prisma.gameLog.count({
                where: whereCondition
            });
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
        }
        catch (error) {
            console.error('게임 기록 조회 오류:', error);
            return {
                success: false,
                error: 'GAME_HISTORY_FETCH_FAILED',
                message: '게임 기록 조회 중 오류가 발생했습니다.'
            };
        }
    }
    async getGameStats(walletAddress) {
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
        }
        catch (error) {
            console.error('게임 통계 조회 오류:', error);
            return {
                success: false,
                error: 'GAME_STATS_FETCH_FAILED',
                message: '게임 통계 조회 중 오류가 발생했습니다.'
            };
        }
    }
    async disconnect() {
        await this.prisma.$disconnect();
    }
}
