interface JwtPayload {
    userId: string;
    walletAddress: string;
    telegramId?: string | null;
    isWalletVerified: boolean;
    score: number;
    language: string;
}
export interface WalletVerificationRequest {
    walletAddress: string;
    message: string;
    signature: string;
    telegramId?: string;
}
export interface WalletVerificationResponse {
    success: boolean;
    token?: string;
    user?: {
        id: string;
        walletAddress: string;
        telegramId?: string;
        isWalletVerified: boolean;
        score: number;
        language: string;
    };
    error?: string;
    message?: string;
}
export interface InstallConfirmRequest {
    walletAddress: string;
    telegramId: string;
}
export declare class AuthService {
    private prisma;
    constructor();
    private validateMessageTimestamp;
    private verifySignature;
    private generateJWT;
    private findOrCreateUser;
    verifyWallet(request: WalletVerificationRequest): Promise<WalletVerificationResponse>;
    confirmInstall(request: InstallConfirmRequest): Promise<WalletVerificationResponse>;
    verifyJWT(token: string): JwtPayload | null;
    getUserById(userId: string): Promise<{
        walletAddress: string;
        telegramId: string | null;
        id: string;
        language: string;
        isWalletVerified: boolean;
        isWalletInstalled: boolean;
        score: number;
        lastPlayedAt: Date | null;
        createdAt: Date;
    } | null>;
    disconnect(): Promise<void>;
}
export {};
