export interface RankingRequest {
    limit?: number;
    offset?: number;
    language?: string;
    gameType?: string;
    verifiedOnly?: boolean;
}
export interface RankingUser {
    rank: number;
    walletAddress: string;
    score: number;
    gameCount: number;
    language: string;
    isAirdropEligible: boolean;
    createdAt: Date;
    lastPlayedAt: Date | null;
}
export interface RankingResponse {
    success: boolean;
    ranking?: RankingUser[];
    pagination?: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
    filters?: {
        language: string;
        gameType: string;
        verifiedOnly: boolean;
    };
    cached?: boolean;
    error?: string;
    message?: string;
}
export interface TopRankingRequest {
    count?: number;
    language?: string;
    verifiedOnly?: boolean;
}
export interface TopRankingResponse {
    success: boolean;
    topRanking?: RankingUser[];
    airdropEligible?: RankingUser[];
    summary?: {
        totalUsers: number;
        averageScore: number;
        topScore: number;
        activeLanguages: string[];
    };
    cached?: boolean;
    error?: string;
    message?: string;
}
export declare class RankingService {
    private prisma;
    private cache;
    private activeQueries;
    constructor();
    private validateInput;
    private withConcurrencyLimit;
    getRanking(request: RankingRequest): Promise<RankingResponse>;
    private getOverallRanking;
    private getGameSpecificRanking;
    getTopRanking(request: TopRankingRequest): Promise<TopRankingResponse>;
    getUserRanking(walletAddress: string): Promise<any>;
    invalidateCache(patterns?: string[]): void;
    disconnect(): Promise<void>;
}
