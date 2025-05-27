// backend/src/services/auth.service.ts
// CreataChain 지갑 인증 비즈니스 로직 서비스
import * as jwt from 'jsonwebtoken';
import { PrismaClient, User } from '@prisma/client'; // User 임포트 추가
import { DatabaseManager } from '../lib/database'; // DatabaseManager 임포트
import { validateWalletAddress } from '../utils/validation.utils'; // 유틸리티 함수 임포트
import { ethers } from 'ethers'; // ethers는 verifySignature에 필요하므로 유지

// 환경변수 검증 강화
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 하드코딩된 JWT 만료시간 기본값
const JWT_ISSUER = process.env.JWT_ISSUER || 'creata-mission-backend'; // 하드코딩된 JWT 발급자
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'creata-mission-frontend'; // 하드코딩된 JWT 수신자

// 하드코딩된 인증 관련 설정값들
const MESSAGE_EXPIRE_TIME = parseInt(process.env.MESSAGE_EXPIRE_TIME || '300000'); // 하드코딩된 메시지 유효시간 (5분 = 300,000ms)
const DEFAULT_LANGUAGE = process.env.DEFAULT_LANGUAGE || 'en'; // 하드코딩된 기본 언어
const INITIAL_USER_SCORE = parseInt(process.env.INITIAL_USER_SCORE || '0'); // 하드코딩된 사용자 초기 점수
const MESSAGE_TIMESTAMP_PATTERN = process.env.MESSAGE_TIMESTAMP_PATTERN || '@ (\\d+) by'; // 하드코딩된 메시지 타임스탬프 패턴

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다. 보안을 위해 필수 설정입니다.');
}

// JWT 페이로드 타입 정의
interface JwtPayload {
  userId: string;
  walletAddress: string;
  telegramId?: string | null;
  isWalletVerified: boolean;
  score: number;
  language: string;
}

// 인증 요청 인터페이스
export interface WalletVerificationRequest {
  walletAddress: string;
  message: string;
  signature: string;
  telegramId?: string;
}

// 인증 응답 인터페이스
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

// Creata Wallet 설치 확인 요청 인터페이스
export interface InstallConfirmRequest {
  walletAddress: string;
  telegramId: string;
}

export class AuthService {
  private prisma: PrismaClient;
  
  constructor() {
    this.prisma = DatabaseManager.getInstance();
  }

  /**
   * 메시지 타임스탬프 검증 (설정된 시간 이내 생성된 메시지만 허용)
   * @param message - 검증할 메시지
   * @returns 유효하면 true, 아니면 false
   */
  private validateMessageTimestamp(message: string): boolean {
    const timestampRegex = new RegExp(MESSAGE_TIMESTAMP_PATTERN); // 하드코딩된 정규표현식 패턴을 환경변수로 대체
    const timestampMatch = message.match(timestampRegex);
    if (!timestampMatch) {
      return false; // 타임스탬프가 없는 메시지는 거부
    }

    const messageTimestamp = parseInt(timestampMatch[1]);
    const currentTimestamp = Date.now();
    const timeDifference = currentTimestamp - messageTimestamp;
    
    // 하드코딩된 시간 제한(5분)을 환경변수로 대체
    return timeDifference <= MESSAGE_EXPIRE_TIME;
  }

  /**
   * 서명 검증 및 주소 복원
   * @param message - 서명된 메시지
   * @param signature - 지갑 서명
   * @returns 복원된 지갑 주소 또는 null
   */
  private verifySignature(message: string, signature: string): string | null {
    try {
      return ethers.verifyMessage(message, signature);
    } catch (error) {
      console.error('서명 검증 실패:', error);
      return null;
    }
  }

  /**
   * JWT 토큰 생성
   * @param user - 사용자 정보
   * @returns JWT 토큰
   */
  private generateJWT(user: User): string {
    const tokenPayload: JwtPayload = {
      userId: user.id,
      walletAddress: user.walletAddress,
      telegramId: user.telegramId,
      isWalletVerified: user.isWalletVerified,
      score: user.score,
      language: user.language
    };

    return jwt.sign(tokenPayload, JWT_SECRET, { 
      expiresIn: JWT_EXPIRES_IN,
      issuer: JWT_ISSUER, // 하드코딩된 JWT 발급자를 환경변수로 대체
      audience: JWT_AUDIENCE // 하드코딩된 JWT 수신자를 환경변수로 대체
    });
  }

  /**
   * 사용자 찾기 또는 생성
   * @param walletAddress - 지갑 주소
   * @param telegramId - 텔레그램 ID (선택적)
   * @returns 사용자 정보
   */
  private async findOrCreateUser(walletAddress: string, telegramId?: string) {
    const normalizedAddress = walletAddress.toLowerCase();

    // 기존 사용자 찾기
    let user = await this.prisma.user.findUnique({
      where: { walletAddress: normalizedAddress }
    });

    if (!user) {
      // 새 사용자 생성
      user = await this.prisma.user.create({
        data: {
          walletAddress: normalizedAddress,
          telegramId: telegramId || null,
          language: DEFAULT_LANGUAGE, // 하드코딩된 기본 언어를 환경변수로 대체
          isWalletVerified: true,
          isWalletInstalled: false, // 하드코딩된 지갑 설치 상태 초기값
          verifiedAt: new Date(),
          lastLoginAt: new Date(),
          score: INITIAL_USER_SCORE // 하드코딩된 사용자 초기 점수를 환경변수로 대체
        }
      });
      console.log(`새 사용자 생성됨: ${walletAddress}`);
    } else {
      // 기존 사용자 로그인 시간 업데이트
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isWalletVerified: true,
          verifiedAt: new Date(),
          lastLoginAt: new Date(),
          // telegramId 업데이트 (새로 제공된 경우)
          ...(telegramId && { telegramId })
        }
      });
      console.log(`기존 사용자 로그인: ${walletAddress}`);
    }

    return user;
  }

  /**
   * Creata Wallet 서명 검증 및 JWT 발급
   * @param request - 지갑 검증 요청
   * @returns 검증 결과 및 JWT 토큰
   */
  async verifyWallet(request: WalletVerificationRequest): Promise<WalletVerificationResponse> {
    const { walletAddress, message, signature, telegramId } = request;

    // 1. 필수 필드 검증
    if (!walletAddress || !message || !signature) {
      return {
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: '지갑 주소, 메시지, 서명이 모두 필요합니다.'
      };
    }

    // 2. 지갑 주소 형식 검증
    if (!validateWalletAddress(walletAddress)) {
      return {
        success: false,
        error: 'INVALID_WALLET_ADDRESS',
        message: '올바르지 않은 지갑 주소 형식입니다.'
      };
    }

    if (!this.validateMessageTimestamp(message)) {
      return {
        success: false,
        error: 'MESSAGE_EXPIRED',
        message: `메시지가 만료되었습니다. (${MESSAGE_EXPIRE_TIME/1000/60}분 이내 생성된 메시지만 허용)` // 하드코딩된 에러 메시지를 동적으로 생성
      };
    }

    // 4. 서명 검증 - 메시지로부터 지갑 주소 복원
    const recoveredAddress = this.verifySignature(message, signature);
    if (!recoveredAddress) {
      return {
        success: false,
        error: 'SIGNATURE_VERIFICATION_FAILED',
        message: '서명 검증에 실패했습니다.'
      };
    }

    // 5. 복원된 주소와 제출된 주소 비교
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return {
        success: false,
        error: 'ADDRESS_MISMATCH',
        message: '서명된 주소와 제출된 주소가 일치하지 않습니다.'
      };
    }

    try {
      // 6. 사용자 찾기 또는 생성
      const user = await this.findOrCreateUser(walletAddress, telegramId);

      // 7. JWT 토큰 생성
      const token = this.generateJWT(user);

      return {
        success: true,
        token,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          telegramId: user.telegramId || undefined,
          isWalletVerified: user.isWalletVerified,
          score: user.score,
          language: user.language
        }
      };

    } catch (error) {
      console.error('데이터베이스 에러:', error);
      return {
        success: false,
        error: 'DATABASE_ERROR',
        message: '사용자 정보 처리 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * Creata Wallet 설치 확인
   * @param request - 설치 확인 요청
   * @returns 설치 확인 결과
   */
  async confirmInstall(request: InstallConfirmRequest): Promise<WalletVerificationResponse> {
    const { walletAddress, telegramId } = request;

    // 1. 필수 필드 검증
    if (!walletAddress || !telegramId) {
      return {
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: '지갑 주소와 텔레그램 ID가 모두 필요합니다.'
      };
    }

    // 2. 지갑 주소 형식 검증
    if (!validateWalletAddress(walletAddress)) {
      return {
        success: false,
        error: 'INVALID_WALLET_ADDRESS',
        message: '올바르지 않은 지갑 주소 형식입니다.'
      };
    }

    try {
      // 3. 사용자 찾기
      const user = await this.prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() }
      });

      if (!user) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: '사용자를 찾을 수 없습니다. 먼저 지갑 인증을 진행해주세요.'
        };
      }

      // 4. 설치 상태 업데이트
      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isWalletInstalled: true,
          telegramId: telegramId,
          lastLoginAt: new Date()
        }
      });

      console.log(`Creata Wallet 설치 확인: ${walletAddress}`);

      return {
        success: true,
        user: {
          id: updatedUser.id,
          walletAddress: updatedUser.walletAddress,
          telegramId: updatedUser.telegramId || undefined,
          isWalletVerified: updatedUser.isWalletVerified,
          score: updatedUser.score,
          language: updatedUser.language
        }
      };

    } catch (error) {
      console.error('설치 확인 데이터베이스 에러:', error);
      return {
        success: false,
        error: 'DATABASE_ERROR',
        message: '설치 확인 처리 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * JWT 토큰 검증
   * @param token - 검증할 JWT 토큰
   * @returns 토큰 페이로드 또는 null
   */
  verifyJWT(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET, {
        issuer: JWT_ISSUER, // 하드코딩된 JWT 발급자를 환경변수로 대체
        audience: JWT_AUDIENCE // 하드코딩된 JWT 수신자를 환경변수로 대체
      }) as JwtPayload;
    } catch (error) {
      console.error('JWT 검증 실패:', error);
      return null;
    }
  }

  /**
   * 사용자 ID로 사용자 정보 조회
   * @param userId - 사용자 ID
   * @returns 사용자 정보 또는 null
   */
  async getUserById(userId: string) {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          walletAddress: true,
          telegramId: true,
          isWalletVerified: true,
          isWalletInstalled: true,
          score: true,
          language: true,
          verifiedAt: true,
          lastLoginAt: true,
          createdAt: true
        }
      });
    } catch (error) {
      console.error('사용자 조회 에러:', error);
      return null;
    }
  }

  /**
   * 리소스 정리 (앱 종료 시 호출)
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}