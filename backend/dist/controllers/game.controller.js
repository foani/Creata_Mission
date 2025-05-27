import { GameService } from '../services/game.service';
import { logger } from '../utils/logger';
export class GameController {
    gameService;
    constructor() {
        this.gameService = new GameService();
        async;
        submitGame(req, GameSubmitRequest, res, Response);
        Promise < void  > {
            const: startTime = Date.now(),
            const: { walletAddress, gameType, score, result, round } = req.body,
            try: {
                logger, : .info('게임 결과 제출 요청', {
                    walletAddress: walletAddress?.substring(0, 10) + '...',
                    gameType,
                    score,
                    round,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip
                }),
                if(, walletAddress) { }
            } || !gameType || score === undefined || !result
        };
        {
            logger.warn('게임 결과 제출 - 필수 파라미터 누락', {
                hasWalletAddress: !!walletAddress,
                hasGameType: !!gameType,
                hasScore: score !== undefined,
                hasResult: !!result
            });
            res.status(400).json({
                success: false,
                error: 'MISSING_REQUIRED_PARAMS',
                message: '지갑 주소, 게임 타입, 점수, 결과가 모두 필요합니다.'
            });
            return;
        }
        const validGameTypes = ['binary', 'derby', 'darts'];
        if (!validGameTypes.includes(gameType)) {
            logger.warn('게임 결과 제출 - 유효하지 않은 게임 타입', { gameType });
            res.status(400).json({
                success: false,
                error: 'INVALID_GAME_TYPE',
                message: '유효하지 않은 게임 타입입니다.'
            });
            return;
        }
        if (score < 0 || score > 1000) {
            logger.warn('게임 결과 제출 - 유효하지 않은 점수', { score });
            res.status(400).json({
                success: false,
                error: 'INVALID_SCORE',
                message: '점수는 0~1000 사이의 값이어야 합니다.'
            });
            return;
        }
        const submissionResult = await this.gameService.submitGame({
            walletAddress,
            gameType,
            score,
            result,
            round: round || Date.now()
        });
        const processingTime = Date.now() - startTime;
        logger.info('게임 결과 제출 성공', {
            walletAddress: walletAddress.substring(0, 10) + '...',
            gameType,
            score,
            newTotalScore: submissionResult.totalScore,
            processingTime: `${processingTime}ms`
        });
        res.status(200).json({
            success: true,
            gameLog: {
                id: submissionResult.gameLog.id,
                gameType: submissionResult.gameLog.gameType,
                score: submissionResult.gameLog.score,
                result: submissionResult.gameLog.result,
                round: submissionResult.gameLog.round,
                createdAt: submissionResult.gameLog.createdAt
            },
            user: {
                id: submissionResult.user.id,
                walletAddress: submissionResult.user.walletAddress,
                totalScore: submissionResult.user.score,
                lastPlayedAt: submissionResult.user.lastPlayedAt
            },
            totalScore: submissionResult.totalScore,
            message: `${gameType} 게임 결과가 성공적으로 저장되었습니다.`
        });
    }
    catch(error) {
        const processingTime = Date.now() - startTime;
        logger.error('게임 결과 제출 실패', {
            walletAddress: walletAddress?.substring(0, 10) + '...',
            gameType,
            score,
            error: error.message,
            stack: error.stack,
            processingTime: `${processingTime}ms`
        });
        let statusCode = 500;
        let errorCode = 'INTERNAL_SERVER_ERROR';
        if (error.message.includes('User not found') || error.message.includes('사용자를 찾을 수 없습니다')) {
            statusCode = 404;
            errorCode = 'USER_NOT_FOUND';
        }
        else if (error.message.includes('지갑 주소') || error.message.includes('wallet address')) {
            statusCode = 400;
            errorCode = 'INVALID_WALLET_ADDRESS';
        }
        else if (error.message.includes('duplicate') || error.message.includes('중복')) {
            statusCode = 409;
            errorCode = 'DUPLICATE_GAME_SUBMISSION';
        }
        res.status(statusCode).json({
            success: false,
            error: errorCode,
            message: error.message || '게임 결과 제출 중 오류가 발생했습니다.'
        });
    }
    async getGameStats(req, res) {
        const { walletAddress } = req.params;
        try {
            logger.info('게임 통계 조회 요청', {
                walletAddress: walletAddress?.substring(0, 10) + '...',
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
            if (!walletAddress) {
                res.status(400).json({
                    success: false,
                    error: 'MISSING_WALLET_ADDRESS',
                    message: '지갑 주소가 필요합니다.'
                });
                return;
            }
            const stats = await this.gameService.getGameStats(walletAddress);
            logger.info('게임 통계 조회 성공', {
                walletAddress: walletAddress.substring(0, 10) + '...',
                totalGames: stats.totalGames,
                totalScore: stats.totalScore
            });
            res.status(200).json({
                success: true,
                stats: {
                    totalGames: stats.totalGames,
                    totalScore: stats.totalScore,
                    averageScore: stats.averageScore,
                    gameTypeStats: stats.gameTypeStats,
                    recentActivity: stats.recentActivity,
                    bestScore: stats.bestScore,
                    winRate: stats.winRate
                },
                message: '게임 통계 조회 완료'
            });
        }
        catch (error) {
            logger.error('게임 통계 조회 실패', {
                walletAddress: walletAddress?.substring(0, 10) + '...',
                error: error.message,
                stack: error.stack
            });
            res.status(500).json({
                success: false,
                error: 'GAME_STATS_FETCH_FAILED',
                message: error.message || '게임 통계 조회 중 오류가 발생했습니다.'
            });
        }
    }
    async disconnect() {
        await this.gameService.disconnect();
    }
}
export const gameController = new GameController();
