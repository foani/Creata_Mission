export declare const CREATA_CHAIN_CONFIG: {
    name: string;
    rpcUrl: string;
    chainId: number;
    currencySymbol: string;
    blockExplorerUrl: string;
};
export interface TransactionResult {
    success: boolean;
    txHash?: string;
    error?: string;
    gasUsed?: string;
    blockNumber?: number;
}
export interface TokenBalance {
    balance: string;
    decimals: number;
    symbol: string;
}
declare class CreataChainManager {
    private provider;
    private signer?;
    private ctaContract?;
    constructor();
    checkConnection(): Promise<boolean>;
    getCtaBalance(walletAddress: string): Promise<TokenBalance | null>;
    sendCta(toAddress: string, amount: string): Promise<TransactionResult>;
    batchSendCta(recipients: {
        address: string;
        amount: string;
    }[]): Promise<TransactionResult[]>;
    getTransactionStatus(txHash: string): Promise<{
        success: boolean;
        blockNumber?: number;
        confirmations?: number;
        gasUsed?: string;
    }>;
    getAdminCtaBalance(): Promise<string | null>;
    getGasPrice(): Promise<string>;
    getCurrentBlockNumber(): Promise<number>;
}
export declare const creataChain: CreataChainManager;
export declare function isValidAddress(address: string): boolean;
export declare function formatCta(amount: bigint | string, decimals?: number): string;
export declare function parseCta(amount: string, decimals?: number): bigint;
export declare function isValidTxHash(hash: string): boolean;
export {};
