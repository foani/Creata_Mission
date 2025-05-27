import { Prisma } from '@prisma/client';
export interface CryptoPricePredictionResult {
    prediction: 'up' | 'down';
    correct: boolean;
    actualPrice?: number;
    predictedPrice?: number;
}
export interface DerbyGameResult {
    selectedHorse: number;
    winningHorse: number;
    correct: boolean;
    raceTime?: number;
}
export interface DartsGameResult {
    survivalTime: number;
    targetTime: number;
    success: boolean;
    hitCount?: number;
}
export type GameResult = CryptoPricePredictionResult | DerbyGameResult | DartsGameResult;
export interface GameSubmissionRequest {
    walletAddress: string;
    gameType: string;
    score: number;
    round?: number;
    result: GameResult;
    metadata?: Record<string, any>;
}
export interface GameSubmissionResponse {
    success: boolean;
    gameLog?: {
        id: number;
        gameType: string;
        score: number;
        round: number;
        createdAt: Date;
    };
    user?: {
        id: string;
        walletAddress: string;
        totalScore: number;
        lastPlayedAt: Date;
    };
    error?: string;
    message?: string;
}
export interface GameHistoryRequest {
    walletAddress: string;
    gameType?: string;
    limit?: number;
    offset?: number;
}
interface GameLogHistoryEntry {
    id: number;
    gameType: string;
    round: number;
    score: number;
    result: Prisma.JsonValue;
    metadata: Prisma.JsonValue;
    createdAt: Date;
}
export interface GameHistoryResponse {
    success: boolean;
    games?: GameLogHistoryEntry[];
    pagination?: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
    user?: {
        walletAddress: string;
        totalScore: number;
        lastPlayedAt: Date | null;
    };
    error?: string;
    message?: string;
}
export declare class GameService {
    private prisma;
    constructor();
    private validateWalletAddress;
    private validateGameType;
    private validateScore;
    private validateGameSubmission;
    private calculateCryptoBonus;
    submitGame(request: GameSubmissionRequest): Promise<GameSubmissionResponse>;
    getGameHistory(request: GameHistoryRequest): Promise<GameHistoryResponse>;
    getGameStats(walletAddress: string): Promise<{
        success: boolean;
        error: string;
        message: string;
        stats?: never;
        user?: never;
    } | {
        success: boolean;
        stats: {
            gameType: string;
            totalGames: number;
            totalScore: number;
            avgScore: number;
            maxScore: number;
        }[];
        user: {
            walletAddress: string;
            totalScore: number;
            lastPlayedAt: Date | null;
        };
        error?: never;
        message?: never;
    }>;
    disconnect(): Promise<void>;
}
export {};
