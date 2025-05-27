import express from 'express';
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
router.post('/verify-wallet', async (req, res) => {
    try {
        const { walletAddress, message, signature, telegramId } = req.body;
        if (!walletAddress || !message || !signature) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_REQUIRED_FIELDS',
                message: '지갑 주소, 메시지, 서명이 모두 필요합니다.'
            });
        }
        if (!ethers.isAddress(walletAddress)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_WALLET_ADDRESS',
                message: '올바르지 않은 지갑 주소 형식입니다.'
            });
        }
        let recoveredAddress;
        try {
            recoveredAddress = ethers.verifyMessage(message, signature);
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                error: 'SIGNATURE_VERIFICATION_FAILED',
                message: '서명 검증에 실패했습니다.'
            });
        }
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            return res.status(401).json({
                success: false,
                error: 'ADDRESS_MISMATCH',
                message: '서명된 주소와 제출된 주소가 일치하지 않습니다.'
            });
        }
        const messagePattern = /^Creata 인증 요청 @ \d+ by 0x[a-fA-F0-9]{40}$/;
        if (!messagePattern.test(message)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_MESSAGE_FORMAT',
                message: '올바르지 않은 인증 메시지 형식입니다.'
            });
        }
        const timestampMatch = message.match(/@ (\d+) by/);
        if (timestampMatch) {
            const messageTimestamp = parseInt(timestampMatch[1]);
            const currentTimestamp = Date.now();
            const timeDifference = currentTimestamp - messageTimestamp;
            if (timeDifference > 300000) {
                return res.status(401).json({
                    success: false,
                    error: 'MESSAGE_EXPIRED',
                    message: '인증 메시지가 만료되었습니다. 새로운 메시지로 다시 시도해주세요.'
                });
            }
        }
        let user;
        try {
            user = await prisma.user.findUnique({
                where: { walletAddress: walletAddress.toLowerCase() }
            });
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        walletAddress: walletAddress.toLowerCase(),
                        telegramId: telegramId || null,
                        isWalletVerified: true,
                        createdAt: new Date()
                    }
                });
                console.log(`새 사용자 생성됨: ${walletAddress}`);
            }
            else {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        isWalletVerified: true,
                        ...(telegramId && { telegramId })
                    }
                });
                console.log(`기존 사용자 로그인: ${walletAddress}`);
            }
        }
        catch (dbError) {
            console.error('데이터베이스 오류:', dbError);
            return res.status(500).json({
                success: false,
                error: 'DATABASE_ERROR',
                message: '사용자 정보 처리 중 오류가 발생했습니다.'
            });
        }
        const tokenPayload = {
            userId: user.id,
            walletAddress: user.walletAddress,
            telegramId: user.telegramId,
            isWalletVerified: user.isWalletVerified
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN
        });
        res.json({
            success: true,
            message: '지갑 인증이 완료되었습니다.',
            data: {
                token,
                user: {
                    id: user.id,
                    walletAddress: user.walletAddress,
                    telegramId: user.telegramId,
                    isWalletVerified: user.isWalletVerified,
                    createdAt: user.createdAt,
                }
            }
        });
    }
    catch (error) {
        console.error('지갑 인증 API 오류:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: '서버 내부 오류가 발생했습니다.'
        });
    }
});
router.post('/install-confirm', async (req, res) => {
    try {
        const { walletAddress, telegramId } = req.body;
        if (!walletAddress || !telegramId) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_REQUIRED_FIELDS',
                message: '지갑 주소와 텔레그램 ID가 필요합니다.'
            });
        }
        if (!ethers.isAddress(walletAddress)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_WALLET_ADDRESS',
                message: '올바르지 않은 지갑 주소 형식입니다.'
            });
        }
        const user = await prisma.user.update({
            where: { walletAddress: walletAddress.toLowerCase() },
            data: {
                isWalletInstalled: true,
                telegramId,
            }
        });
        res.json({
            success: true,
            message: 'Creata Wallet 설치가 확인되었습니다.',
            data: {
                walletAddress: user.walletAddress,
                isWalletInstalled: user.isWalletInstalled,
                telegramId: user.telegramId
            }
        });
    }
    catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: 'USER_NOT_FOUND',
                message: '해당 지갑 주소로 등록된 사용자를 찾을 수 없습니다.'
            });
        }
        console.error('설치 확인 API 오류:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: '서버 내부 오류가 발생했습니다.'
        });
    }
});
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'TOKEN_MISSING',
                message: '인증 토큰이 필요합니다.'
            });
        }
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
            if (typeof decoded === 'string' || !decoded.userId) {
                return res.status(401).json({
                    success: false,
                    error: 'TOKEN_INVALID',
                    message: '잘못된 토큰 형식입니다.'
                });
            }
        }
        catch (jwtError) {
            return res.status(401).json({
                success: false,
                error: 'TOKEN_INVALID',
                message: '유효하지 않은 인증 토큰입니다.'
            });
        }
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                walletAddress: true,
                telegramId: true,
                isWalletVerified: true,
                isWalletInstalled: true,
                score: true,
                language: true,
                createdAt: true,
            }
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'USER_NOT_FOUND',
                message: '사용자를 찾을 수 없습니다.'
            });
        }
        res.json({
            success: true,
            data: { user }
        });
    }
    catch (error) {
        console.error('사용자 정보 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: '서버 내부 오류가 발생했습니다.'
        });
    }
});
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});
export default router;
