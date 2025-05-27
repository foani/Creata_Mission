/**
 * 블록체인 설정 - 간소화된 버전
 * CreataChain (Catena 메인넷) 연동 설정
 */

import { ethers } from 'ethers';
import { logger, CREATA_CHAIN_CONFIG } from '../utils';

export interface BlockchainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  currencySymbol: string;
  blockExplorerUrl: string;
  ctaTokenAddress: string;
  adminPrivateKey?: string;
}

const getBlockchainConfig = (): BlockchainConfig => {
  return {
    chainId: CREATA_CHAIN_CONFIG.chainId,
    name: CREATA_CHAIN_CONFIG.name,
    rpcUrl: CREATA_CHAIN_CONFIG.rpcUrl,
    currencySymbol: CREATA_CHAIN_CONFIG.currencySymbol,
    blockExplorerUrl: CREATA_CHAIN_CONFIG.blockExplorerUrl,
    // 하드코딩된 CTA 토큰 주소
    ctaTokenAddress: process.env.CTA_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',
    adminPrivateKey: process.env.ADMIN_PRIVATE_KEY
  };
};

class BlockchainManager {
  private static instance: BlockchainManager;
  private config: BlockchainConfig;
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Wallet | null = null;

  private constructor() {
    this.config = getBlockchainConfig();
  }

  public static getInstance(): BlockchainManager {
    if (!BlockchainManager.instance) {
      BlockchainManager.instance = new BlockchainManager();
    }
    return BlockchainManager.instance;
  }

  public async initialize(): Promise<void> {
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
      } else {
        logger.warn('어드민 개인키가 설정되지 않음 - 읽기 전용 모드');
      }

    } catch (error) {
      logger.error('블록체인 초기화 실패', { error });
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.provider) return false;
      await this.provider.getBlockNumber();
      return true;
    } catch (error) {
      logger.error('블록체인 상태 확인 실패', { error });
      return false;
    }
  }

  public getConfig(): BlockchainConfig {
    return { ...this.config };
  }

  public getProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      throw new Error('프로바이더가 초기화되지 않음');
    }
    return this.provider;
  }

  public getSigner(): ethers.Wallet {
    if (!this.signer) {
      throw new Error('사이너가 초기화되지 않음');
    }
    return this.signer;
  }

  public async disconnect(): Promise<void> {
    this.provider = null;
    this.signer = null;
    logger.info('블록체인 연결 해제');
  }
}

export const blockchainManager = BlockchainManager.getInstance();
export const blockchainConfig = getBlockchainConfig();

export async function initializeBlockchain(): Promise<void> {
  try {
    await blockchainManager.initialize();
    logger.info('블록체인 초기화 완료');
  } catch (error) {
    logger.error('블록체인 초기화 실패', { error });
    throw error;
  }
}

export async function cleanupBlockchain(): Promise<void> {
  try {
    await blockchainManager.disconnect();
    logger.info('블록체인 정리 완료');
  } catch (error) {
    logger.error('블록체인 정리 실패', { error });
  }
}