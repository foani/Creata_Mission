/**
 * 상수 정의
 * 전체 애플리케이션에서 사용되는 상수값들
 */

/**
 * 게임 종류 열거형
 */
export enum GameType {
  BINARY_OPTIONS = 'binary',
  LAZY_DERBY = 'derby',
  REVERSE_DARTS = 'darts'
}

/**
 * 게임별 기본 메타데이터
 */
export const GAME_METADATA = {
  [GameType.BINARY_OPTIONS]: {
    name: 'Binary Options',
    nameKo: '이진 옵션',
    description: '코인 가격 예측 게임',
    maxScore: 100,
    minScore: 0,
    defaultDuration: 60 // 초
  },
  [GameType.LAZY_DERBY]: {
    name: 'Lazy Derby',
    nameKo: '게으른 경마',
    description: '가장 느린 말 맞추기',
    maxScore: 150,
    minScore: 0,
    defaultDuration: 30
  },
  [GameType.REVERSE_DARTS]: {
    name: 'Reverse Darts',
    nameKo: '리버스 다트',
    description: '화살 피하기 게임',
    maxScore: 200,
    minScore: 0,
    defaultDuration: 10
  }
};

/**
 * 에어드랙 관련 상수
 */
export const AIRDROP_CONFIG = {
  // 하드코딩된 랜킹 보상 설정
  RANKING_REWARDS: {
    1: '100.0', // 1등 CTA 양
    2: '50.0',  // 2등
    3: '30.0',  // 3등
    4: '20.0',  // 4등
    5: '10.0'   // 5등
  },
  MIN_GAMES_FOR_REWARD: 5, // 보상 받기 위한 최소 게임 횟수
  MIN_SCORE_FOR_REWARD: 100, // 보상 받기 위한 최소 점수
  BATCH_SIZE: 5, // 한 번에 처리할 에어드랙 개수
  RETRY_ATTEMPTS: 3 // 에어드랙 실패 시 재시도 횟수
};

/**
 * API 응답 상태 코드
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
} as const;

/**
 * 에러 메시지 상수
 */
export const ERROR_MESSAGES = {
  // 인증 관련
  INVALID_WALLET_ADDRESS: '유효하지 않은 지갑 주소입니다.',
  SIGNATURE_VERIFICATION_FAILED: '서명 검증에 실패했습니다.',
  USER_NOT_FOUND: '사용자를 찾을 수 없습니다.',
  
  // 게임 관련
  INVALID_GAME_TYPE: '지원되지 않는 게임 종류입니다.',
  INVALID_SCORE: '유효하지 않은 점수입니다.',
  GAME_SUBMISSION_FAILED: '게임 결과 제출에 실패했습니다.',
  
  // 에어드랙 관련
  INSUFFICIENT_BALANCE: 'CTA 토큰 잔액이 부족합니다.',
  AIRDROP_FAILED: '에어드랙 전송에 실패했습니다.',
  INVALID_AMOUNT: '유효하지 않은 금액입니다.',
  
  // 일반
  INTERNAL_ERROR: '내부 서버 오류가 발생했습니다.',
  VALIDATION_ERROR: '입력값 검증에 실패했습니다.',
  DATABASE_ERROR: '데이터베이스 오류가 발생했습니다.'
} as const;

/**
 * 성공 메시지 상수
 */
export const SUCCESS_MESSAGES = {
  WALLET_VERIFIED: '지갑 인증이 성공적으로 완료되었습니다.',
  WALLET_INSTALLED: 'Creata Wallet 설치가 확인되었습니다.',
  GAME_SUBMITTED: '게임 결과가 성공적으로 제출되었습니다.',
  AIRDROP_COMPLETED: '에어드랙이 성공적으로 완료되었습니다.',
  RANKING_UPDATED: '랜킹이 업데이트되었습니다.'
} as const;

/**
 * 다국어 지원 언어 코드
 */
export const SUPPORTED_LANGUAGES = {
  KO: 'ko', // 한국어
  EN: 'en', // 영어
  VI: 'vi', // 베트남어
  JA: 'ja'  // 일본어
} as const;

/**
 * 기본 설정값
 */
export const DEFAULT_CONFIG = {
  PAGE_SIZE: 20, // 기본 페이지 크기
  MAX_PAGE_SIZE: 100, // 최대 페이지 크기
  DEFAULT_LANGUAGE: SUPPORTED_LANGUAGES.EN, // 기본 언어
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24시간 (ms)
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15분 (ms)
  RATE_LIMIT_MAX_REQUESTS: 100 // 15분당 최대 요청 수
} as const;

/**
 * JWT 관련 상수
 */
export const JWT_CONFIG = {
  // 하드코딩된 JWT 비밀키 (운영에서는 환경변수 사용)
  SECRET: process.env.JWT_SECRET || 'creata-mission-jwt-secret-key-2025',
  EXPIRES_IN: '7d', // 7일
  ALGORITHM: 'HS256'
} as const;

/**
 * 데이터베이스 관련 상수
 */
export const DATABASE_CONFIG = {
  CONNECTION_TIMEOUT: 30000, // 30초
  QUERY_TIMEOUT: 15000, // 15초
  MAX_CONNECTIONS: 10, // 최대 연결 수
  IDLE_TIMEOUT: 600000 // 10분
} as const;

/**
 * 커스텀 에러 클래스
 */
export class CreataMissionError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  
  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = 'CreataMissionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * 자주 사용되는 정규식 패턴
 */
export const REGEX_PATTERNS = {
  ETHEREUM_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  TRANSACTION_HASH: /^0x[a-fA-F0-9]{64}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  TELEGRAM_ID: /^[0-9]+$/,
  LANGUAGE_CODE: /^(ko|en|vi|ja)$/
} as const;