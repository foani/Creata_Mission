import { ethers } from 'ethers';
import { logger } from './logger';
export const CREATA_CHAIN_CONFIG = {
    name: 'Catena (CIP-20) Chain Mainnet',
    rpcUrl: 'https://cvm.node.creatachain.com',
    chainId: 1000,
    currencySymbol: 'CTA',
    blockExplorerUrl: 'https://catena.explorer.creatachain.com'
};
const DEFAULT_ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const CTA_TOKEN_ADDRESS = process.env.CTA_TOKEN_ADDRESS || DEFAULT_ZERO_ADDRESS;
const ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function totalSupply() view returns (uint256)',
    'event Transfer(address indexed from, address indexed to, uint256 value)'
];
class CreataChainManager {
    provider;
    signer;
    ctaContract;
    constructor() {
        this.provider = new ethers.JsonRpcProvider(CREATA_CHAIN_CONFIG.rpcUrl);
        const privateKey = process.env.ADMIN_PRIVATE_KEY;
        if (privateKey) {
            if (CTA_TOKEN_ADDRESS === DEFAULT_ZERO_ADDRESS) {
                logger.error('CTA_TOKEN_ADDRESS가 기본값입니다. 컨트랙트 연동이 불가합니다.');
                return;
            }
            this.signer = new ethers.Wallet(privateKey, this.provider);
            this.ctaContract = new ethers.Contract(CTA_TOKEN_ADDRESS, ERC20_ABI, this.signer);
            logger.info('CreataChain 어드민 지갑 연결 완료');
        }
        else {
            logger.warn('ADMIN_PRIVATE_KEY 환경변수가 설정되지 않음 - 읽기 전용 모드');
        }
    }
    async checkConnection() {
        try {
            const network = await this.provider.getNetwork();
            const isCorrectChain = Number(network.chainId) === CREATA_CHAIN_CONFIG.chainId;
            if (isCorrectChain) {
                logger.info(`CreataChain 연결 성공: 체인 ID ${network.chainId}`);
                return true;
            }
            else {
                logger.error(`잘못된 체인 ID: 예상 ${CREATA_CHAIN_CONFIG.chainId}, 실제 ${network.chainId}`);
                return false;
            }
        }
        catch (error) {
            logger.error('CreataChain 연결 실패', { error: error instanceof Error ? error.message : error });
            return false;
        }
    }
    async getCtaBalance(walletAddress) {
        try {
            if (!this.ctaContract) {
                throw new Error('CTA 토큰 컨트랙트가 초기화되지 않음');
            }
            const balance = await this.ctaContract.balanceOf(walletAddress);
            const decimals = await this.ctaContract.decimals();
            const symbol = await this.ctaContract.symbol();
            const result = {
                balance: ethers.formatUnits(balance, decimals),
                decimals: Number(decimals),
                symbol
            };
            logger.debug(`CTA 잔액 조회 완료: ${walletAddress}`, result);
            return result;
        }
        catch (error) {
            logger.error(`CTA 잔액 조회 실패: ${walletAddress}`, { error: error instanceof Error ? error.message : error });
            return null;
        }
    }
    async sendCta(toAddress, amount) {
        try {
            if (!this.signer || !this.ctaContract) {
                throw new Error('어드민 지갑 또는 CTA 컨트랙트가 초기화되지 않음');
            }
            if (!ethers.isAddress(toAddress)) {
                throw new Error(`유효하지 않은 주소 형식: ${toAddress}`);
            }
            const decimals = await this.ctaContract.decimals();
            const amountInWei = ethers.parseUnits(amount, decimals);
            const estimatedGas = await this.ctaContract.transfer.estimateGas(toAddress, amountInWei);
            const gasLimit = estimatedGas * BigInt(120) / BigInt(100);
            const tx = await this.ctaContract.transfer(toAddress, amountInWei, {
                gasLimit
            });
            logger.info(`CTA 전송 트랜잭션 발송: ${amount} CTA → ${toAddress}`, { txHash: tx.hash });
            const receipt = await tx.wait();
            const result = {
                success: true,
                txHash: tx.hash,
                gasUsed: receipt?.gasUsed?.toString(),
                blockNumber: receipt?.blockNumber
            };
            logger.info(`CTA 전송 완료: ${amount} CTA → ${toAddress}`, result);
            return result;
        }
        catch (error) {
            const result = {
                success: false,
                error: error instanceof Error ? error.message : '알 수 없는 오류'
            };
            logger.error(`CTA 전송 실패: ${amount} CTA → ${toAddress}`, result);
            return result;
        }
    }
    async batchSendCta(recipients) {
        const results = [];
        logger.info(`대량 CTA 전송 시작: ${recipients.length}개 주소`);
        for (const recipient of recipients) {
            try {
                const result = await this.sendCta(recipient.address, recipient.amount);
                results.push(result);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                const failResult = {
                    success: false,
                    error: error instanceof Error ? error.message : '배치 전송 오류'
                };
                results.push(failResult);
                logger.error(`배치 전송 중 오류: ${recipient.address}`, { error });
            }
        }
        const successCount = results.filter(r => r.success).length;
        logger.info(`대량 CTA 전송 완료: ${successCount}/${recipients.length} 성공`);
        return results;
    }
    async getTransactionStatus(txHash) {
        try {
            const receipt = await this.provider.getTransactionReceipt(txHash);
            if (!receipt) {
                return { success: false };
            }
            const currentBlock = await this.provider.getBlockNumber();
            const confirmations = currentBlock - receipt.blockNumber;
            return {
                success: receipt.status === 1,
                blockNumber: receipt.blockNumber,
                confirmations,
                gasUsed: receipt.gasUsed.toString()
            };
        }
        catch (error) {
            logger.error(`트랜잭션 상태 확인 실패: ${txHash}`, { error });
            return { success: false };
        }
    }
    async getAdminCtaBalance() {
        if (!this.signer) {
            logger.warn('어드민 지갑이 설정되지 않음');
            return null;
        }
        const balance = await this.getCtaBalance(this.signer.address);
        return balance?.balance || null;
    }
    async getGasPrice() {
        try {
            const feeData = await this.provider.getFeeData();
            return ethers.formatUnits(feeData.gasPrice || 0, 'gwei');
        }
        catch (error) {
            logger.error('가스 가격 조회 실패', { error });
            return '0';
        }
    }
    async getCurrentBlockNumber() {
        try {
            return await this.provider.getBlockNumber();
        }
        catch (error) {
            logger.error('현재 블록 번호 조회 실패', { error });
            return 0;
        }
    }
}
export const creataChain = new CreataChainManager();
export function isValidAddress(address) {
    return ethers.isAddress(address);
}
export function formatCta(amount, decimals = 18) {
    return ethers.formatUnits(amount, decimals);
}
export function parseCta(amount, decimals = 18) {
    return ethers.parseUnits(amount, decimals);
}
export function isValidTxHash(hash) {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
}
