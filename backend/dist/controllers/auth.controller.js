import { AuthService } from '../services/auth.service';
import { logger } from '../utils/logger';
export class AuthController {
    authService;
    constructor() {
        this.authService = new AuthService();
    }
    async verifyWallet(req, res) {
        const startTime = Date.now();
        const { walletAddress, message, signature, telegramId } = req.body;
        try {
            logger.info('지갑 인증 요청 시작', {
                walletAddress: walletAddress?.substring(0, 10) + '...',
                hasTelegramId: !!telegramId,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
            if (!walletAddress || !message || !signature) {
                logger.warn('지갑 인증 요청 - 필수 파라미터 누락', {
                    hasWalletAddress: !!walletAddress,
                    hasMessage: !!message,
                    hasSignature: !!signature
                });
                res.status(400).json({
                    success: false,
                    error: 'MISSING_REQUIRED_PARAMS',
                    message: '지갑 주소, 메시지, 서명이 모두 필요합니다.'
                });
                return;
            }
            const result = await this.authService.verifyWallet({
                walletAddress,
                message,
                signature,
                telegramId
            });
            const processingTime = Date.now() - startTime;
            logger.info('지갑 인증 성공', {
                walletAddress: walletAddress.substring(0, 10) + '...',
                verified: result.verified,
                isNewUser: !result.existingUser,
                processingTime: `${processingTime}ms`
            });
            res.status(200).json({
                success: true,
                verified: result.verified,
                token: result.token,
                user: {
                    id: result.user.id,
                    walletAddress: result.user.walletAddress,
                    telegramId: result.user.telegramId,
                    score: result.user.score,
                    language: result.user.language,
                    isWalletVerified: result.user.isWalletVerified,
                    isWalletInstalled: result.user.isWalletInstalled
                },
                message: result.isNewUser ? '새 사용자로 등록되었습니다.' : '기존 사용자 인증 완료'
            });
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            logger.error('지갑 인증 실패', {
                walletAddress: walletAddress?.substring(0, 10) + '...',
                error: error.message,
                stack: error.stack,
                processingTime: `${processingTime}ms`
            });
            let statusCode = 500;
            let errorCode = 'INTERNAL_SERVER_ERROR';
            if (error.message.includes('Invalid signature') || error.message.includes('서명이 유효하지 않습니다')) {
                statusCode = 401;
                errorCode = 'INVALID_SIGNATURE';
            }
            else if (error.message.includes('지갑 주소') || error.message.includes('wallet address')) {
                statusCode = 400;
                errorCode = 'INVALID_WALLET_ADDRESS';
            }
            else if (error.message.includes('expired') || error.message.includes('만료')) {
                statusCode = 401;
                errorCode = 'MESSAGE_EXPIRED';
            }
            res.status(statusCode).json({
                success: false,
                error: errorCode,
                message: error.message || '지갑 인증 처리 중 오류가 발생했습니다.'
            });
        }
        async;
        confirmInstall(req, InstallRequest, res, Response);
        Promise < void  > {
            const: startTime = Date.now(),
            const: { walletAddress, telegramId } = req.body,
            try: {
                logger, : .info('지갑 설치 확인 요청', {
                    walletAddress: walletAddress?.substring(0, 10) + '...',
                    telegramId,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip
                }),
                if(, walletAddress) { }
            } || !telegramId
        };
        {
            logger.warn('지갑 설치 확인 - 필수 파라미터 누락', {
                hasWalletAddress: !!walletAddress,
                hasTelegramId: !!telegramId
            });
            res.status(400).json({
                success: false,
                error: 'MISSING_REQUIRED_PARAMS',
                message: '지갑 주소와 텔레그램 ID가 모두 필요합니다.'
            });
            return;
        }
        const result = await this.authService.confirmInstall({
            walletAddress,
            telegramId
        });
        const processingTime = Date.now() - startTime;
        logger.info('지갑 설치 확인 완료', {
            walletAddress: walletAddress.substring(0, 10) + '...',
            installed: result.verified,
            processingTime: `${processingTime}ms`
        });
        res.status(200).json({
            success: true,
            installed: result.verified,
            token: result.token,
            user: {
                id: result.user.id,
                walletAddress: result.user.walletAddress,
                telegramId: result.user.telegramId,
                score: result.user.score,
                language: result.user.language,
                isWalletVerified: result.user.isWalletVerified,
                isWalletInstalled: result.user.isWalletInstalled
            },
            message: 'Creata Wallet 설치가 확인되었습니다.'
        });
    }
    catch(error) {
        const processingTime = Date.now() - startTime;
        logger.error('지갑 설치 확인 실패', {
            walletAddress: walletAddress?.substring(0, 10) + '...',
            telegramId,
            error: error.message,
            stack: error.stack,
            processingTime: `${processingTime}ms`
        });
        res.status(500).json({
            success: false,
            error: 'INSTALL_CONFIRM_FAILED',
            message: error.message || '지갑 설치 확인 처리 중 오류가 발생했습니다.'
        });
    }
}
async;
getUserInfo(req, UserInfoRequest, res, Response);
Promise < void  > {
    const: { userId } = req.params,
    try: {
        logger, : .info('사용자 정보 조회 요청', {
            userId,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        }),
        if(, userId) {
            res.status(400).json({
                success: false,
                error: 'MISSING_USER_ID',
                message: '사용자 ID가 필요합니다.'
            });
            return;
        },
        const: user = await this.authService.getUserById(userId),
        if(, user) {
            logger.warn('사용자 정보 조회 - 사용자 없음', { userId });
            res.status(404).json({
                success: false,
                error: 'USER_NOT_FOUND',
                message: '사용자를 찾을 수 없습니다.'
            });
            return;
        },
        logger, : .info('사용자 정보 조회 성공', {
            userId,
            walletAddress: user.walletAddress.substring(0, 10) + '...'
        }),
        res, : .status(200).json({
            success: true,
            user: {
                id: user.id,
                walletAddress: user.walletAddress,
                telegramId: user.telegramId,
                score: user.score,
                language: user.language,
                isWalletVerified: user.isWalletVerified,
                isWalletInstalled: user.isWalletInstalled,
                createdAt: user.createdAt,
                lastPlayedAt: user.lastPlayedAt
            }
        })
    }, catch(error) {
        logger.error('사용자 정보 조회 실패', {
            userId,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            error: 'USER_INFO_FETCH_FAILED',
            message: error.message || '사용자 정보 조회 중 오류가 발생했습니다.'
        });
    }
};
async;
healthCheck(req, Request, res, Response);
Promise < void  > {
    try: {
        await, this: .authService.getUserById('test-id'),
        res, : .status(200).json({
            success: true,
            message: 'Auth service is healthy',
            timestamp: new Date().toISOString(),
            service: 'auth'
        })
    }, catch(error) {
        logger.error('Auth 서비스 헬스체크 실패', {
            error: error.message
        });
        res.status(503).json({
            success: false,
            message: 'Auth service is unhealthy',
            error: error.message,
            timestamp: new Date().toISOString(),
            service: 'auth'
        });
    }
};
async;
disconnect();
Promise < void  > {
    await, this: .authService.disconnect()
};
export const authController = new AuthController();
