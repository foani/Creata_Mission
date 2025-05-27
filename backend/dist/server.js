import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import authRouter from './routes/auth.js';
import gameRouter from './routes/game.js';
import rankingRouter from './routes/ranking.js';
import airdropRouter from './routes/airdrop.js';
import adminRouter from './routes/admin.js';
dotenv.config();
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
function setupBasicMiddleware() {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
            },
        },
    }));
    const corsOptions = {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [
            'http://localhost:3001',
            'http://localhost:5173',
            'https://t.me'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    };
    app.use(cors(corsOptions));
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use('/logs', express.static(path.join(__dirname, '../logs')));
}
function setupRoutes() {
    app.get('/health', async (req, res) => {
        try {
            await prisma.$queryRaw `SELECT 1`;
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV,
                database: 'connected'
            });
        }
        catch (error) {
            console.error('Health check failed:', error);
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: '데이터베이스 연결 실패'
            });
        }
    });
    app.use('/api/auth', authRouter);
    app.use('/api/game', gameRouter);
    app.use('/api/ranking', rankingRouter);
    app.use('/api/airdrop', airdropRouter);
    app.use('/api/admin', adminRouter);
    app.use('*', (req, res) => {
        res.status(404).json({
            success: false,
            error: 'ENDPOINT_NOT_FOUND',
            message: `요청한 API 엔드포인트를 찾을 수 없습니다: ${req.method} ${req.originalUrl}`,
            timestamp: new Date().toISOString()
        });
    });
}
function setupErrorHandling() {
    process.on('uncaughtException', (error) => {
        console.error('⚠️  Uncaught Exception:', error);
        process.exit(1);
    });
    process.on('unhandledRejection', (reason, promise) => {
        console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
        process.exit(1);
    });
    app.use((error, req, res, next) => {
        console.error('🔴 Express Error:', error);
        if (error.code && error.code.startsWith('P')) {
            return res.status(400).json({
                success: false,
                error: 'DATABASE_ERROR',
                message: '데이터베이스 오류가 발생했습니다.',
                code: error.code
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'INVALID_TOKEN',
                message: '유효하지 않은 인증 토큰입니다.'
            });
        }
        res.status(error.status || 500).json({
            success: false,
            error: error.name || 'INTERNAL_SERVER_ERROR',
            message: error.message || '내부 서버 오류가 발생했습니다.',
            timestamp: new Date().toISOString(),
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    });
}
function setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
        console.log(`\n🛑 ${signal} 신호 수신, 서버를 원한 종료합니다...`);
        try {
            await prisma.$disconnect();
            console.log('✅ 데이터베이스 연결을 종료했습니다.');
            console.log('🚀 서버가 안전하게 종료되었습니다.');
            process.exit(0);
        }
        catch (error) {
            console.error('❌ 서버 종료 중 오류 발생:', error);
            process.exit(1);
        }
    };
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
async function startServer() {
    try {
        console.log('🚀 CreataChain 미션 게임 백엔드 서버 시작...');
        setupBasicMiddleware();
        console.log('✅ 기본 미들웨어 설정 완료');
        await prisma.$connect();
        console.log('✅ PostgreSQL 데이터베이스 연결 성공');
        setupRoutes();
        console.log('✅ API 라우터 설정 완료');
        setupErrorHandling();
        console.log('✅ 에러 핸들링 설정 완료');
        setupGracefulShutdown();
        console.log('✅ 원한 종료 설정 완료');
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n🎉 서버가 성공적으로 시작되었습니다!`);
            console.log(`\n📍 서버 정보:`);
            console.log(`   - 포트: ${PORT}`);
            console.log(`   - 환경: ${process.env.NODE_ENV || 'development'}`);
            console.log(`   - 로컬 URL: http://localhost:${PORT}`);
            console.log(`   - 헬스 체크: http://localhost:${PORT}/health`);
            console.log(`\n🔍 API 엔드포인트:`);
            console.log(`   - POST /api/auth/verify-wallet - 지갑 인증`);
            console.log(`   - POST /api/game/submit - 게임 결과 제출`);
            console.log(`   - GET  /api/ranking - 랭킹 조회`);
            console.log(`   - POST /api/airdrop/execute - 에어드랍 실행`);
            console.log(`\n🚪 종료하려면 Ctrl+C 를 눌러주세요.\n`);
        });
    }
    catch (error) {
        console.error('❌ 서버 시작 실패:', error);
        process.exit(1);
    }
}
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
    startServer();
}
export { app, prisma, startServer };
