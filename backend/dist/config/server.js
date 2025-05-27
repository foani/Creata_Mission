import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { logger, DEFAULT_CONFIG, JWT_CONFIG } from '../utils';
const getServerConfig = () => {
    const environment = process.env.NODE_ENV || 'development';
    let port = parseInt(process.env.PORT || '3000', 10);
    if (isNaN(port))
        port = 3000;
    const baseConfig = {
        port,
        host: process.env.HOST || '0.0.0.0',
        cors: {
            origin: true,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: [
                'Origin',
                'X-Requested-With',
                'Content-Type',
                'Accept',
                'Authorization',
                'X-Telegram-Bot-Api-Secret-Token'
            ]
        },
        rateLimit: {
            windowMs: DEFAULT_CONFIG.RATE_LIMIT_WINDOW,
            max: DEFAULT_CONFIG.RATE_LIMIT_MAX_REQUESTS,
            message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
        },
        jwt: {
            secret: JWT_CONFIG.SECRET,
            expiresIn: JWT_CONFIG.EXPIRES_IN
        }
    };
    switch (environment) {
        case 'production':
            return {
                ...baseConfig,
                cors: {
                    ...baseConfig.cors,
                    origin: [
                        'https://t.me',
                        'https://web.telegram.org',
                        process.env.FRONTEND_URL || 'https://creata-mission.com'
                    ]
                },
                rateLimit: {
                    ...baseConfig.rateLimit,
                    max: 50
                }
            };
        case 'development':
        default:
            return {
                ...baseConfig,
                cors: {
                    ...baseConfig.cors,
                    origin: [
                        'http://localhost:3000',
                        'http://localhost:3001',
                        'http://localhost:5173',
                        'https://t.me'
                    ]
                }
            };
    }
};
export const createCorsMiddleware = (config) => {
    return cors({
        origin: (origin, callback) => {
            if (!origin) {
                return callback(null, true);
            }
            if (Array.isArray(config.cors.origin)) {
                const isAllowed = config.cors.origin.some(allowedOrigin => {
                    if (typeof allowedOrigin === 'string') {
                        return allowedOrigin === origin;
                    }
                    return false;
                });
                return callback(null, isAllowed);
            }
            if (typeof config.cors.origin === 'boolean') {
                return callback(null, config.cors.origin);
            }
            return callback(null, config.cors.origin === origin);
        },
        credentials: config.cors.credentials,
        methods: config.cors.methods,
        allowedHeaders: config.cors.allowedHeaders
    });
};
export const createRateLimitMiddleware = (config) => {
    return rateLimit({
        windowMs: config.rateLimit.windowMs,
        max: config.rateLimit.max,
        message: {
            error: config.rateLimit.message,
            code: 'RATE_LIMIT_EXCEEDED'
        },
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                path: req.path,
                userAgent: req.get('User-Agent')
            });
            res.status(429).json({
                success: false,
                error: config.rateLimit.message,
                code: 'RATE_LIMIT_EXCEEDED'
            });
        },
        skip: (req) => {
            const skipPaths = ['/health', '/api/health'];
            return skipPaths.includes(req.path);
        }
    });
};
export const createRequestLoggerMiddleware = () => {
    return (req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            const logData = {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip
            };
            if (res.statusCode >= 400) {
                logger.warn('HTTP 요청 오류', logData);
            }
            else {
                logger.info('HTTP 요청 완료', logData);
            }
        });
        next();
    };
};
export const createErrorHandlerMiddleware = () => {
    return (error, req, res, next) => {
        logger.error('서버 에러 발생', {
            error: error.message,
            stack: error.stack,
            path: req.path,
            method: req.method,
            ip: req.ip
        });
        const statusCode = error.statusCode || 500;
        const message = process.env.NODE_ENV === 'production'
            ? '내부 서버 오류가 발생했습니다.'
            : error.message;
        res.status(statusCode).json({
            success: false,
            error: message,
            code: error.code || 'INTERNAL_SERVER_ERROR'
        });
    };
};
export const createNotFoundHandlerMiddleware = () => {
    return (req, res) => {
        logger.warn('404 - 경로를 찾을 수 없음', {
            path: req.path,
            method: req.method,
            ip: req.ip
        });
        res.status(404).json({
            success: false,
            error: '요청한 경로를 찾을 수 없습니다.',
            code: 'NOT_FOUND'
        });
    };
};
export const serverConfig = getServerConfig();
export function logServerConfig() {
    logger.info('서버 설정 로드 완료', {
        environment: process.env.NODE_ENV,
        port: serverConfig.port,
        host: serverConfig.host,
        corsOrigins: serverConfig.cors.origin,
        rateLimitMax: serverConfig.rateLimit.max
    });
}
