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
const safeParseFloat = (value, defaultValue) => {
    if (value === undefined)
        return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
};
const safeParseInt = (value, defaultValue) => {
    if (value === undefined)
        return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};
const AIRDROP_CONFIG = {
    DEFAULT_AMOUNT: safeParseFloat(process.env.AIRDROP_DEFAULT_AMOUNT, 10.0),
    RANKING_REWARDS: {
        1: safeParseFloat(process.env.AIRDROP_RANK_1_REWARD, 50.0),
        2: safeParseFloat(process.env.AIRDROP_RANK_2_REWARD, 30.0),
        3: safeParseFloat(process.env.AIRDROP_RANK_3_REWARD, 20.0),
        4: safeParseFloat(process.env.AIRDROP_RANK_4_REWARD, 15.0),
        5: safeParseFloat(process.env.AIRDROP_RANK_5_REWARD, 10.0)
    },
    MAX_AMOUNT: safeParseFloat(process.env.AIRDROP_MAX_AMOUNT, 1000.0),
    MIN_AMOUNT: safeParseFloat(process.env.AIRDROP_MIN_AMOUNT, 1.0),
    BATCH_SIZE: safeParseInt(process.env.AIRDROP_BATCH_SIZE, 10),
    MAX_RETRIES: safeParseInt(process.env.AIRDROP_MAX_RETRIES, 3),
    RETRY_DELAY: safeParseInt(process.env.AIRDROP_RETRY_DELAY, 5000),
    GAS_LIMIT: safeParseInt(process.env.AIRDROP_GAS_LIMIT, 100000),
    TOP_RANKS_COUNT: safeParseInt(process.env.AIRDROP_TOP_RANKS, 5)
};
const NETWORK_CONFIG = {
    RPC_URL: process.env.CREATA_RPC_URL || 'https://cvm.node.creatachain.com',
    CHAIN_ID: parseInt(process.env.CREATA_CHAIN_ID || '1000'),
    PRIVATE_KEY: process.env.AIRDROP_PRIVATE_KEY,
    CTA_TOKEN_ADDRESS: process.env.CTA_TOKEN_ADDRESS
};
if (!NETWORK_CONFIG.PRIVATE_KEY) {
    throw new Error('AIRDROP_PRIVATE_KEY 환경변수가 설정되지 않았습니다.');
}
if (!NETWORK_CONFIG.CTA_TOKEN_ADDRESS) {
    throw new Error('CTA_TOKEN_ADDRESS 환경변수가 설정되지 않았습니다.');
}
export class AirdropService {
    prisma;
    provider;
    wallet;
    ctaToken;
    constructor() {
        this.prisma = DatabaseManager.getInstance();
        this.provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.RPC_URL);
        this.wallet = new ethers.Wallet(NETWORK_CONFIG.PRIVATE_KEY, this.provider);
        if (NETWORK_CONFIG.CTA_TOKEN_ADDRESS) {
            const erc20Abi = [
                'function transfer(address to, uint256 amount) returns (bool)',
                'function balanceOf(address account) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function symbol() view returns (string)',
                'event Transfer(address indexed from, address indexed to, uint256 value)'
            ];
            this.ctaToken = new ethers.Contract(NETWORK_CONFIG.CTA_TOKEN_ADDRESS, erc20Abi, this.wallet);
        }
    }
    validateAirdropRequest(request) {
        const { walletAddress, rewardType, ctaAmount } = request;
        if (!ethers.isAddress(walletAddress)) {
            return { valid: false, error: '올바르지 않은 지갑 주소 형식입니다.' };
        }
        const validRewardTypes = ['ranking', 'event', 'referral', 'bonus', 'admin'];
        if (!validRewardTypes.includes(rewardType)) {
            return { valid: false, error: `올바르지 않은 보상 타입입니다. 지원 타입: ${validRewardTypes.join(', ')}` };
        }
        if (typeof ctaAmount !== 'number' || ctaAmount <= 0) {
            return { valid: false, error: 'CTA 수량은 0보다 큰 숫자여야 합니다.' };
        }
        if (ctaAmount < AIRDROP_CONFIG.MIN_AMOUNT) {
            return { valid: false, error: `최소 에어드랍 수량은 ${AIRDROP_CONFIG.MIN_AMOUNT} CTA입니다.` };
        }
        if (ctaAmount > AIRDROP_CONFIG.MAX_AMOUNT) {
            return { valid: false, error: `최대 에어드랍 수량은 ${AIRDROP_CONFIG.MAX_AMOUNT} CTA입니다.` };
        }
        return { valid: true };
    }
    async addToQueue(request) {
        const validation = this.validateAirdropRequest(request);
        if (!validation.valid) {
            return {
                success: false,
                error: 'INVALID_INPUT',
                message: validation.error
            };
        }
        const { walletAddress, rewardType, ctaAmount, description, metadata } = request;
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
            const existingQueue = await this.prisma.airdropQueue.findFirst({
                where: {
                    userId: user.id,
                    rewardType,
                    status: 'pending'
                }
            });
            if (existingQueue) {
                return {
                    success: false,
                    error: 'DUPLICATE_QUEUE',
                    message: '동일한 보상 타입의 대기 중인 에어드랍이 이미 존재합니다.'
                };
            }
            const airdropQueue = await this.prisma.airdropQueue.create({
                data: {
                    userId: user.id,
                    rewardType,
                    ctaAmount: ctaAmount.toString(),
                    description: description || `${rewardType} reward`,
                    metadata: metadata || {},
                    status: 'pending',
                    createdAt: new Date()
                }
            });
            return {
                success: true,
                message: '에어드랍 큐에 성공적으로 추가되었습니다.',
                data: {
                    queueId: airdropQueue.id,
                    walletAddress: user.walletAddress,
                    ctaAmount,
                    rewardType
                }
            };
        }
        catch (error) {
            console.error('에어드랍 큐 추가 오류:', error);
            return {
                success: false,
                error: 'QUEUE_ADD_FAILED',
                message: '에어드랍 큐 추가 중 오류가 발생했습니다.'
            };
        }
    }
    async createRankingAirdrop(request = {}) {
        const { language, customRewards, description } = request;
        try {
            const whereCondition = {
                score: { gte: 1 },
                isWalletVerified: true
            };
            if (language) {
                whereCondition.language = language;
            }
            const topUsers = await this.prisma.user.findMany({
                where: whereCondition,
                orderBy: [
                    { score: 'desc' },
                    { createdAt: 'asc' }
                ],
                take: AIRDROP_CONFIG.TOP_RANKS_COUNT,
                select: {
                    id: true,
                    walletAddress: true,
                    score: true,
                    language: true
                }
            });
            if (topUsers.length === 0) {
                return {
                    success: false,
                    error: 'NO_ELIGIBLE_USERS',
                    message: '에어드랍 대상자가 없습니다.'
                };
            }
            const airdropPromises = topUsers.map(async (user, index) => {
                const rank = index + 1;
                const rewardAmount = customRewards?.[rank] || AIRDROP_CONFIG.RANKING_REWARDS[rank] || 0;
                if (rewardAmount <= 0)
                    return null;
                return this.prisma.airdropQueue.create({
                    data: {
                        userId: user.id,
                        rewardType: 'ranking',
                        ctaAmount: rewardAmount.toString(),
                        description: description || `Rank ${rank} reward (${user.score} points)`,
                        metadata: {
                            rank,
                            score: user.score,
                            language: user.language
                        },
                        status: 'pending'
                    }
                });
            });
            const results = await Promise.all(airdropPromises);
            const created = results.filter(result => result !== null);
            return {
                success: true,
                message: `${created.length}명의 상위 랭킹 사용자에 대한 에어드랍이 생성되었습니다.`,
                data: {
                    created: created.length,
                    totalAmount: created.reduce((sum, item) => sum + parseFloat(item.ctaAmount), 0),
                    rankings: topUsers.map((user, index) => ({
                        rank: index + 1,
                        walletAddress: user.walletAddress,
                        score: user.score,
                        reward: customRewards?.[index + 1] || AIRDROP_CONFIG.RANKING_REWARDS[(index + 1)] || 0
                    }))
                }
            };
        }
        catch (error) {
            console.error('랭킹 에어드랍 생성 오류:', error);
            return {
                success: false,
                error: 'RANKING_AIRDROP_FAILED',
                message: '랭킹 기반 에어드랍 생성 중 오류가 발생했습니다.'
            };
        }
    }
    async sendCTAToken(toAddress, amount, retries = 0) {
        if (!this.ctaToken) {
            return { success: false, error: 'CTA 토큰 컨트랙트가 초기화되지 않았습니다.' };
        }
        try {
            const decimals = await this.ctaToken.decimals();
            const amountInWei = ethers.parseUnits(amount.toString(), decimals);
            const balance = await this.ctaToken.balanceOf(this.wallet.address);
            if (balance < amountInWei) {
                return { success: false, error: '전송 계정의 CTA 토큰 잔액이 부족합니다.' };
            }
            const tx = await this.ctaToken.transfer(toAddress, amountInWei, {
                gasLimit: AIRDROP_CONFIG.GAS_LIMIT
            });
            const receipt = await tx.wait();
            if (receipt?.status === 1) {
                return { success: true, txHash: receipt.hash };
            }
            else {
                return { success: false, error: '트랜잭션이 실패했습니다.' };
            }
        }
        catch (error) {
            console.error(`CTA 전송 오류 (시도 ${retries + 1}):`, error);
            if (retries < AIRDROP_CONFIG.MAX_RETRIES) {
                console.log(`${AIRDROP_CONFIG.RETRY_DELAY}ms 후 재시도...`);
                await new Promise(resolve => setTimeout(resolve, AIRDROP_CONFIG.RETRY_DELAY));
                return this.sendCTAToken(toAddress, amount, retries + 1);
            }
            return {
                success: false,
                error: error.message || '알 수 없는 오류가 발생했습니다.'
            };
        }
    }
    async executeAirdrop(request = {}) {
        const { queueIds, rewardType, maxAmount, dryRun = false } = request;
        try {
            const whereCondition = {
                status: 'pending'
            };
            if (queueIds && queueIds.length > 0) {
                whereCondition.id = { in: queueIds };
            }
            if (rewardType) {
                whereCondition.rewardType = rewardType;
            }
            const pendingAirdrops = await this.prisma.airdropQueue.findMany({
                where: whereCondition,
                include: {
                    user: {
                        select: {
                            walletAddress: true
                        }
                    }
                },
                take: AIRDROP_CONFIG.BATCH_SIZE,
                orderBy: { createdAt: 'asc' }
            });
            if (pendingAirdrops.length === 0) {
                return {
                    success: false,
                    processed: 0,
                    failed: 0,
                    totalAmount: 0,
                    transactions: [],
                    message: '실행할 에어드랍이 없습니다.'
                };
            }
            const totalAmount = pendingAirdrops.reduce((sum, airdrop) => sum + parseFloat(airdrop.ctaAmount), 0);
            if (maxAmount && totalAmount > maxAmount) {
                return {
                    success: false,
                    processed: 0,
                    failed: 0,
                    totalAmount,
                    transactions: [],
                    error: 'AMOUNT_LIMIT_EXCEEDED',
                    message: `총 에어드랍 금액(${totalAmount} CTA)이 제한(${maxAmount} CTA)을 초과합니다.`
                };
            }
            if (dryRun) {
                const dryRunTransactions = pendingAirdrops.map(airdrop => ({
                    id: airdrop.id,
                    walletAddress: airdrop.user.walletAddress,
                    amount: parseFloat(airdrop.ctaAmount),
                    status: 'success'
                }));
                return {
                    success: true,
                    processed: pendingAirdrops.length,
                    failed: 0,
                    totalAmount,
                    transactions: dryRunTransactions,
                    message: `Dry run 완료: ${pendingAirdrops.length}개 에어드랍, 총 ${totalAmount} CTA`
                };
            }
            const transactions = [];
            let processed = 0;
            let failed = 0;
            for (const airdrop of pendingAirdrops) {
                const amount = parseFloat(airdrop.ctaAmount);
                const walletAddress = airdrop.user.walletAddress;
                const sendResult = await this.sendCTAToken(walletAddress, amount);
                if (sendResult.success) {
                    await this.prisma.airdropQueue.update({
                        where: { id: airdrop.id },
                        data: {
                            status: 'success',
                            txHash: sendResult.txHash,
                            processedAt: new Date()
                        }
                    });
                    transactions.push({
                        id: airdrop.id,
                        walletAddress,
                        amount,
                        txHash: sendResult.txHash,
                        status: 'success'
                    });
                    processed++;
                    console.log(`에어드랍 성공: ${walletAddress} - ${amount} CTA - ${sendResult.txHash}`);
                }
                else {
                    await this.prisma.airdropQueue.update({
                        where: { id: airdrop.id },
                        data: {
                            status: 'failed',
                            processedAt: new Date(),
                            metadata: {
                                ...airdrop.metadata,
                                error: sendResult.error
                            }
                        }
                    });
                    transactions.push({
                        id: airdrop.id,
                        walletAddress,
                        amount,
                        status: 'failed',
                        error: sendResult.error
                    });
                    failed++;
                    console.error(`에어드랍 실패: ${walletAddress} - ${amount} CTA - ${sendResult.error}`);
                }
                if (processed + failed < pendingAirdrops.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            return {
                success: true,
                processed,
                failed,
                totalAmount,
                transactions,
                message: `에어드랍 완료: 성공 ${processed}개, 실패 ${failed}개, 총 ${totalAmount} CTA`
            };
        }
        catch (error) {
            console.error('에어드랍 실행 오류:', error);
            return {
                success: false,
                processed: 0,
                failed: 0,
                totalAmount: 0,
                transactions: [],
                error: 'EXECUTION_FAILED',
                message: '에어드랍 실행 중 오류가 발생했습니다.'
            };
        }
    }
    async getAirdropQueue(filters = {}) {
        const { status, rewardType, limit = 20, offset = 0 } = filters;
        try {
            const whereCondition = {};
            if (status)
                whereCondition.status = status;
            if (rewardType)
                whereCondition.rewardType = rewardType;
            const [queueItems, total] = await Promise.all([
                this.prisma.airdropQueue.findMany({
                    where: whereCondition,
                    include: {
                        user: {
                            select: {
                                walletAddress: true,
                                language: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    skip: offset
                }),
                this.prisma.airdropQueue.count({ where: whereCondition })
            ]);
            return {
                success: true,
                data: {
                    items: queueItems.map(item => ({
                        id: item.id,
                        walletAddress: item.user.walletAddress,
                        rewardType: item.rewardType,
                        ctaAmount: parseFloat(item.ctaAmount),
                        description: item.description,
                        status: item.status,
                        txHash: item.txHash,
                        createdAt: item.createdAt,
                        processedAt: item.processedAt,
                        metadata: item.metadata
                    })),
                    pagination: {
                        total,
                        limit,
                        offset,
                        hasMore: total > offset + limit
                    }
                }
            };
        }
        catch (error) {
            console.error('에어드랍 큐 조회 오류:', error);
            return {
                success: false,
                error: 'QUEUE_FETCH_FAILED',
                message: '에어드랍 큐 조회 중 오류가 발생했습니다.'
            };
        }
    }
    async getAirdropStats() {
        try {
            const [totalStats, statusStats, rewardTypeStats] = await Promise.all([
                this.prisma.airdropQueue.aggregate({
                    _sum: { ctaAmount: true },
                    _count: { id: true }
                }),
                this.prisma.airdropQueue.groupBy({
                    by: ['status'],
                    _sum: { ctaAmount: true },
                    _count: { id: true }
                }),
                this.prisma.airdropQueue.groupBy({
                    by: ['rewardType'],
                    _sum: { ctaAmount: true },
                    _count: { id: true }
                })
            ]);
            return {
                success: true,
                data: {
                    total: {
                        count: totalStats._count.id,
                        amount: parseFloat(totalStats._sum.ctaAmount || '0')
                    },
                    byStatus: statusStats.map(stat => ({
                        status: stat.status,
                        count: stat._count.id,
                        amount: parseFloat(stat._sum.ctaAmount || '0')
                    })),
                    byRewardType: rewardTypeStats.map(stat => ({
                        rewardType: stat.rewardType,
                        count: stat._count.id,
                        amount: parseFloat(stat._sum.ctaAmount || '0')
                    }))
                }
            };
        }
        catch (error) {
            console.error('에어드랍 통계 조회 오류:', error);
            return {
                success: false,
                error: 'STATS_FETCH_FAILED',
                message: '에어드랍 통계 조회 중 오류가 발생했습니다.'
            };
        }
    }
    async disconnect() {
        await this.prisma.$disconnect();
    }
}
