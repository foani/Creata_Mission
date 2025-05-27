export interface WalletVerificationRequest {
    walletAddress: string;
    message: string;
    signature: string;
    timestamp?: number;
}
export interface VerificationResult {
    isValid: boolean;
    recoveredAddress?: string;
    error?: string;
}
export declare function createAuthMessage(walletAddress: string, timestamp?: number): string;
export declare function verifyWalletSignature(request: WalletVerificationRequest): Promise<VerificationResult>;
export declare function isValidTimestamp(message: string): boolean;
export declare function createInstallConfirmMessage(walletAddress: string, telegramId: string): string;
