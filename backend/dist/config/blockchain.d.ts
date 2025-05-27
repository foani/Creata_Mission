import { ethers } from 'ethers';
export interface BlockchainConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    currencySymbol: string;
    blockExplorerUrl: string;
    ctaTokenAddress: string;
    adminPrivateKey?: string;
}
declare class BlockchainManager {
    private static instance;
    private config;
    private provider;
    private signer;
    private constructor();
    static getInstance(): BlockchainManager;
    initialize(): Promise<void>;
    healthCheck(): Promise<boolean>;
    getConfig(): BlockchainConfig;
    getProvider(): ethers.JsonRpcProvider;
    getSigner(): ethers.Wallet;
    disconnect(): Promise<void>;
}
export declare const blockchainManager: BlockchainManager;
export declare const blockchainConfig: BlockchainConfig;
export declare function initializeBlockchain(): Promise<void>;
export declare function cleanupBlockchain(): Promise<void>;
export {};
