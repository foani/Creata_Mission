import { verifyMessage, isAddress } from 'ethers';
import { logger } from './logger';
export function createAuthMessage(walletAddress, timestamp) {
    const ts = timestamp || Date.now();
    return `Creata 인증 요청 @ ${ts} by ${walletAddress}`;
}
export async function verifyWalletSignature(request) {
    try {
        const { walletAddress, message, signature } = request;
        if (!walletAddress || !message || !signature) {
            return {
                isValid: false,
                error: '필수 파라미터가 누락되었습니다.'
            };
        }
        if (!isAddress(walletAddress)) {
            return {
                isValid: false,
                error: '유효하지 않은 지갑 주소 형식입니다.'
            };
        }
        const recoveredAddress = verifyMessage(message, signature);
        const isValid = recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
        if (isValid) {
            logger.info(`지갑 인증 성공: ${walletAddress}`);
        }
        else {
            logger.warn(`지갑 인증 실패: 예상 ${walletAddress}, 복원된 ${recoveredAddress}`);
        }
        return {
            isValid,
            recoveredAddress,
            error: isValid ? undefined : '서명이 지갑 주소와 일치하지 않습니다.'
        };
    }
    catch (error) {
        logger.error('서명 검증 중 오류 발생:', error);
        return {
            isValid: false,
            error: '서명 검증 처리 중 오류가 발생했습니다.'
        };
    }
}
export function isValidTimestamp(message) {
    try {
        const timestampMatch = message.match(/@ (\d+) by/);
        if (!timestampMatch)
            return false;
        const timestamp = parseInt(timestampMatch[1]);
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        return (now - timestamp) <= fiveMinutes;
    }
    catch {
        return false;
    }
}
export function createInstallConfirmMessage(walletAddress, telegramId) {
    return `Creata Wallet 설치 확인 @ ${Date.now()} by ${walletAddress} for Telegram ${telegramId}`;
}
