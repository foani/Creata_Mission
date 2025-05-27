import * as jwt from 'jsonwebtoken';
import { DatabaseManager } from '../lib/database';
import { validateWalletAddress } from '../utils/validation.utils';
import { ethers } from 'ethers';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_ISSUER = process.env.JWT_ISSUER || 'creata-mission-backend';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'creata-mission-frontend';
const MESSAGE_EXPIRE_TIME = parseInt(process.env.MESSAGE_EXPIRE_TIME || '300000');
const DEFAULT_LANGUAGE = process.env.DEFAULT_LANGUAGE || 'en';
const INITIAL_USER_SCORE = parseInt(process.env.INITIAL_USER_SCORE || '0');
const MESSAGE_TIMESTAMP_PATTERN = process.env.MESSAGE_TIMESTAMP_PATTERN || '@ (\\d+) by';
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다. 보안을 위해 필수 설정입니다.');
}
export class AuthService {
    prisma;
    constructor() {
        this.prisma = DatabaseManager.getInstance();
    }
    validateMessageTimestamp(message) {
        const timestampRegex = new RegExp(MESSAGE_TIMESTAMP_PATTERN);
        const timestampMatch = message.match(timestampRegex);
        if (!timestampMatch) {
            return false;
        }
        const messageTimestamp = parseInt(timestampMatch[1]);
        const currentTimestamp = Date.now();
        const timeDifference = currentTimestamp - messageTimestamp;
        return timeDifference <= MESSAGE_EXPIRE_TIME;
    }
    verifySignature(message, signature) {
        try {
            return ethers.verifyMessage(message, signature);
        }
        catch (error) {
            console.error('서명 검증 실패:', error);
            return null;
        }
    }
    generateJWT(user) {
        const tokenPayload = {
            userId: user.id,
            walletAddress: user.walletAddress,
            telegramId: user.telegramId,
            isWalletVerified: user.isWalletVerified,
            score: user.score,
            language: user.language
        };
        return jwt.sign(tokenPayload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE
        });
    }
    async findOrCreateUser(walletAddress, telegramId) {
        const normalizedAddress = walletAddress.toLowerCase();
        let user = await this.prisma.user.findUnique({
            where: { walletAddress: normalizedAddress }
        });
        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    walletAddress: normalizedAddress,
                    telegramId: telegramId || null,
                    language: DEFAULT_LANGUAGE,
                    isWalletVerified: true,
                    isWalletInstalled: false,
                    verifiedAt: new Date(),
                    lastLoginAt: new Date(),
                    score: INITIAL_USER_SCORE
                }
            });
            console.log(`새 사용자 생성됨: ${walletAddress}`);
        }
        else {
            user = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    isWalletVerified: true,
                    verifiedAt: new Date(),
                    lastLoginAt: new Date(),
                    ...(telegramId && { telegramId })
                }
            });
            console.log(`기존 사용자 로그인: ${walletAddress}`);
        }
        return user;
    }
    async verifyWallet(request) {
        const { walletAddress, message, signature, telegramId } = request;
        if (!walletAddress || !message || !signature) {
            return {
                success: false,
                error: 'MISSING_REQUIRED_FIELDS',
                message: '지갑 주소, 메시지, 서명이 모두 필요합니다.'
            };
        }
        if (!validateWalletAddress(walletAddress)) {
            return {
                success: false,
                error: 'INVALID_WALLET_ADDRESS',
                message: '올바르지 않은 지갑 주소 형식입니다.'
            };
        }
        if (!this.validateMessageTimestamp(message)) {
            return {
                success: false,
                error: 'MESSAGE_EXPIRED',
                message: `메시지가 만료되었습니다. (${MESSAGE_EXPIRE_TIME / 1000 / 60}분 이내 생성된 메시지만 허용)`
            };
        }
        const recoveredAddress = this.verifySignature(message, signature);
        if (!recoveredAddress) {
            return {
                success: false,
                error: 'SIGNATURE_VERIFICATION_FAILED',
                message: '서명 검증에 실패했습니다.'
            };
        }
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            return {
                success: false,
                error: 'ADDRESS_MISMATCH',
                message: '서명된 주소와 제출된 주소가 일치하지 않습니다.'
            };
        }
        try {
            const user = await this.findOrCreateUser(walletAddress, telegramId);
            const token = this.generateJWT(user);
            return {
                success: true,
                token,
                user: {
                    id: user.id,
                    walletAddress: user.walletAddress,
                    telegramId: user.telegramId || undefined,
                    isWalletVerified: user.isWalletVerified,
                    score: user.score,
                    language: user.language
                }
            };
        }
        catch (error) {
            console.error('데이터베이스 에러:', error);
            return {
                success: false,
                error: 'DATABASE_ERROR',
                message: '사용자 정보 처리 중 오류가 발생했습니다.'
            };
        }
    }
    async confirmInstall(request) {
        const { walletAddress, telegramId } = request;
        if (!walletAddress || !telegramId) {
            return {
                success: false,
                error: 'MISSING_REQUIRED_FIELDS',
                message: '지갑 주소와 텔레그램 ID가 모두 필요합니다.'
            };
        }
        if (!validateWalletAddress(walletAddress)) {
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
                    message: '사용자를 찾을 수 없습니다. 먼저 지갑 인증을 진행해주세요.'
                };
            }
            const updatedUser = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    isWalletInstalled: true,
                    telegramId: telegramId,
                    lastLoginAt: new Date()
                }
            });
            console.log(`Creata Wallet 설치 확인: ${walletAddress}`);
            return {
                success: true,
                user: {
                    id: updatedUser.id,
                    walletAddress: updatedUser.walletAddress,
                    telegramId: updatedUser.telegramId || undefined,
                    isWalletVerified: updatedUser.isWalletVerified,
                    score: updatedUser.score,
                    language: updatedUser.language
                }
            };
        }
        catch (error) {
            console.error('설치 확인 데이터베이스 에러:', error);
            return {
                success: false,
                error: 'DATABASE_ERROR',
                message: '설치 확인 처리 중 오류가 발생했습니다.'
            };
        }
    }
    verifyJWT(token) {
        try {
            return jwt.verify(token, JWT_SECRET, {
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE
            });
        }
        catch (error) {
            console.error('JWT 검증 실패:', error);
            return null;
        }
    }
    async getUserById(userId) {
        try {
            return await this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    walletAddress: true,
                    telegramId: true,
                    isWalletVerified: true,
                    isWalletInstalled: true,
                    score: true,
                    language: true,
                    verifiedAt: true,
                    lastLoginAt: true,
                    createdAt: true
                }
            });
        }
        catch (error) {
            console.error('사용자 조회 에러:', error);
            return null;
        }
    }
    async disconnect() {
        await this.prisma.$disconnect();
    }
}
