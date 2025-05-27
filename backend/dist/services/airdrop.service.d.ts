export interface AirdropQueueRequest {
    walletAddress: string;
    rewardType: 'ranking' | 'event' | 'referral' | 'bonus' | 'admin';
    ctaAmount: number;
    description?: string;
    metadata?: Record<string, any>;
}
export interface AirdropExecuteRequest {
    queueIds?: number[];
    rewardType?: string;
    maxAmount?: number;
    dryRun?: boolean;
}
export interface AirdropResponse {
    success: boolean;
    message?: string;
    error?: string;
    data?: any;
}
export interface AirdropExecuteResult {
    success: boolean;
    processed: number;
    failed: number;
    totalAmount: number;
    transactions: Array<{
        id: number;
        walletAddress: string;
        amount: number;
        txHash?: string;
        status: 'success' | 'failed';
        error?: string;
    }>;
    error?: string;
    message?: string;
}
export interface RankingAirdropRequest {
    language?: string;
    customRewards?: Record<number, number>;
    description?: string;
}
export declare class AirdropService {
    private prisma;
    private provider;
    private wallet;
    private ctaToken?;
    constructor();
    private validateAirdropRequest;
    addToQueue(request: AirdropQueueRequest): Promise<AirdropResponse>;
    createRankingAirdrop(request?: RankingAirdropRequest): Promise<AirdropResponse>;
    private sendCTAToken;
    executeAirdrop(request?: AirdropExecuteRequest): Promise<AirdropExecuteResult>;
    getAirdropQueue(filters?: {
        status?: 'pending' | 'success' | 'failed';
        rewardType?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        success: boolean;
        data: {
            items: {
                id: number;
                walletAddress: string;
                rewardType: string;
                ctaAmount: number;
                description: any;
                status: string;
                txHash: string | null;
                createdAt: Date;
                processedAt: Date | null;
                metadata: any;
            }[];
            pagination: {
                total: number;
                limit: number;
                offset: number;
                hasMore: boolean;
            };
        };
        error?: never;
        message?: never;
    } | {
        success: boolean;
        error: string;
        message: string;
        data?: never;
    }>;
    getAirdropStats(): Promise<{
        success: boolean;
        data: {
            total: {
                count: number;
                amount: number;
            };
            byStatus: {
                status: string;
                count: number;
                amount: number;
            }[];
            byRewardType: {
                rewardType: string;
                count: number;
                amount: number;
            }[];
        };
        error?: never;
        message?: never;
    } | {
        success: boolean;
        error: string;
        message: string;
        data?: never;
    }>;
    disconnect(): Promise<void>;
}
