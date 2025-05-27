/**
 * 지갑 서명 검증 유틸리티
 * EIP-191 메시지 서명 방식으로 CreataChain 지갑 인증
 */

import { verifyMessage, isAddress } from 'ethers';
import { logger } from './logger';

/**
 * 지갑 서명 검증 인터페이스
 */
export interface WalletVerificationRequest {
  walletAddress: string;
  message: string;
  signature: string;
  timestamp?: number;
}

/**
 * 서명 검증 결과
 */
export interface VerificationResult {
  isValid: boolean;
  recoveredAddress?: string;
  error?: string;
}

/**
 * 인증 메시지 생성
 * @param walletAddress 지갑 주소
 * @param timestamp 타임스탬프 (선택사항)
 * @returns 표준화된 인증 메시지
 */
export function createAuthMessage(walletAddress: string, timestamp?: number): string {
  const ts = timestamp || Date.now();
  return `Creata 인증 요청 @ ${ts} by ${walletAddress}`;
}

/**
 * 지갑 서명 검증
 * @param request 검증 요청 데이터
 * @returns 검증 결과
 */
export async function verifyWalletSignature(
  request: WalletVerificationRequest
): Promise<VerificationResult> {
  try {
    const { walletAddress, message, signature } = request;

    // 입력값 검증
    if (!walletAddress || !message || !signature) {
      return {
        isValid: false,
        error: '필수 파라미터가 누락되었습니다.'
      };
    }

    // 지갑 주소 형식 검증
    if (!isAddress(walletAddress)) { // ethers.isAddress() 사용
      return {
        isValid: false,
        error: '유효하지 않은 지갑 주소 형식입니다.'
      };
    }

    // 서명으로부터 주소 복원
    const recoveredAddress = verifyMessage(message, signature);

    // 주소 일치 확인 (대소문자 구분 없이)
    const isValid = recoveredAddress.toLowerCase() === walletAddress.toLowerCase();

    if (isValid) {
      logger.info(`지갑 인증 성공: ${walletAddress}`);
    } else {
      logger.warn(`지갑 인증 실패: 예상 ${walletAddress}, 복원된 ${recoveredAddress}`);
    }

    return {
      isValid,
      recoveredAddress,
      error: isValid ? undefined : '서명이 지갑 주소와 일치하지 않습니다.'
    };

  } catch (error) {
    logger.error('서명 검증 중 오류 발생:', error);
    return {
      isValid: false,
      error: '서명 검증 처리 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 메시지 타임스탬프 검증 (5분 이내)
 * @param message 인증 메시지
 * @returns 유효한 타임스탬프 여부
 */
export function isValidTimestamp(message: string): boolean {
  try {
    const timestampMatch = message.match(/@ (\d+) by/);
    if (!timestampMatch) return false;

    const timestamp = parseInt(timestampMatch[1]);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    return (now - timestamp) <= fiveMinutes;
  } catch {
    return false;
  }
}

/**
 * 지갑 설치 확인을 위한 특별 메시지 생성
 * @param walletAddress 지갑 주소
 * @param telegramId 텔레그램 사용자 ID
 * @returns 설치 확인 메시지
 */
export function createInstallConfirmMessage(
  walletAddress: string,
  telegramId: string
): string {
  return `Creata Wallet 설치 확인 @ ${Date.now()} by ${walletAddress} for Telegram ${telegramId}`;
}
