import { ethers } from 'ethers';
import { logger, CREATA_CHAIN_CONFIG } from '../utils';
const getBlockchainConfig = () => {
    return {
        chainId: CREATA_CHAIN_CONFIG.chainId,
        name: CREATA_CHAIN_CONFIG.name,
        rpcUrl: CREATA_CHAIN_CONFIG.rpcUrl,
        currencySymbol: CREATA_CHAIN_CONFIG.currencySymbol,
        blockExplorerUrl: CREATA_CHAIN_CONFIG.blockExplorerUrl,
        ctaTokenAddress: process.env.CTA_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',
        adminPrivateKey: process.env.ADMIN_PRIVATE_KEY
    };
};
class BlockchainManager {
    static instance;
    config;
    provider = null;
    signer = null;
    constructor() {
        this.config = getBlockchainConfig();
    }
    static getInstance() {
        if (!BlockchainManager.instance) {
            BlockchainManager.instance = new BlockchainManager();
        }
        return BlockchainManager.instance;
    }
    async initialize() {
        try {
            this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
            const network = await this.provider.getNetwork();
            if (Number(network.chainId) !== this.config.chainId) {
                throw new Error(`잘못된 체인 ID: 예상 ${this.config.chainId}, 실제 ${network.chainId}`);
            }
            logger.info('블록체인 프로바이더 연결 성공', {
                chainId: network.chainId,
                name: network.name
            });
            if (this.config.adminPrivateKey) {
                this.signer = new ethers.Wallet(this.config.adminPrivateKey, this.provider);
                logger.info('어드민 지갑 연결 완료', { address: this.signer.address });
            }
            else {
                logger.warn('어드민 개인키가 설정되지 않음 - 읽기 전용 모드');
            }
        }
        catch (error) {
            logger.error('블록체인 초기화 실패', { error });
            throw error;
        }
    }
    async healthCheck() {
        try {
            if (!this.provider)
                return false;
            await this.provider.getBlockNumber();
            return true;
        }
        catch (error) {
            logger.error('블록체인 상태 확인 실패', { error });
            return false;
        }
    }
    getConfig() {
        return { ...this.config };
    }
    getProvider() {
        if (!this.provider) {
            throw new Error('프로바이더가 초기화되지 않음');
        }
        return this.provider;
    }
    getSigner() {
        if (!this.signer) {
            throw new Error('사이너가 초기화되지 않음');
        }
        return this.signer;
    }
    async disconnect() {
        this.provider = null;
        this.signer = null;
        logger.info('블록체인 연결 해제');
    }
}
export const blockchainManager = BlockchainManager.getInstance();
export const blockchainConfig = getBlockchainConfig();
export async function initializeBlockchain() {
    try {
        await blockchainManager.initialize();
        logger.info('블록체인 초기화 완료');
    }
    catch (error) {
        logger.error('블록체인 초기화 실패', { error });
        throw error;
    }
}
export async function cleanupBlockchain() {
    try {
        await blockchainManager.disconnect();
        logger.info('블록체인 정리 완료');
    }
    catch (error) {
        logger.error('블록체인 정리 실패', { error });
    }
}
