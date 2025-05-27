export var GameType;
(function (GameType) {
    GameType["BINARY_OPTIONS"] = "binary";
    GameType["LAZY_DERBY"] = "derby";
    GameType["REVERSE_DARTS"] = "darts";
})(GameType || (GameType = {}));
export const GAME_METADATA = {
    [GameType.BINARY_OPTIONS]: {
        name: 'Binary Options',
        nameKo: '이진 옵션',
        description: '코인 가격 예측 게임',
        maxScore: 100,
        minScore: 0,
        defaultDuration: 60
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
export const AIRDROP_CONFIG = {
    RANKING_REWARDS: {
        1: '100.0',
        2: '50.0',
        3: '30.0',
        4: '20.0',
        5: '10.0'
    },
    MIN_GAMES_FOR_REWARD: 5,
    MIN_SCORE_FOR_REWARD: 100,
    BATCH_SIZE: 5,
    RETRY_ATTEMPTS: 3
};
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500
};
export const ERROR_MESSAGES = {
    INVALID_WALLET_ADDRESS: '유효하지 않은 지갑 주소입니다.',
    SIGNATURE_VERIFICATION_FAILED: '서명 검증에 실패했습니다.',
    USER_NOT_FOUND: '사용자를 찾을 수 없습니다.',
    INVALID_GAME_TYPE: '지원되지 않는 게임 종류입니다.',
    INVALID_SCORE: '유효하지 않은 점수입니다.',
    GAME_SUBMISSION_FAILED: '게임 결과 제출에 실패했습니다.',
    INSUFFICIENT_BALANCE: 'CTA 토큰 잔액이 부족합니다.',
    AIRDROP_FAILED: '에어드랙 전송에 실패했습니다.',
    INVALID_AMOUNT: '유효하지 않은 금액입니다.',
    INTERNAL_ERROR: '내부 서버 오류가 발생했습니다.',
    VALIDATION_ERROR: '입력값 검증에 실패했습니다.',
    DATABASE_ERROR: '데이터베이스 오류가 발생했습니다.'
};
export const SUCCESS_MESSAGES = {
    WALLET_VERIFIED: '지갑 인증이 성공적으로 완료되었습니다.',
    WALLET_INSTALLED: 'Creata Wallet 설치가 확인되었습니다.',
    GAME_SUBMITTED: '게임 결과가 성공적으로 제출되었습니다.',
    AIRDROP_COMPLETED: '에어드랙이 성공적으로 완료되었습니다.',
    RANKING_UPDATED: '랜킹이 업데이트되었습니다.'
};
export const SUPPORTED_LANGUAGES = {
    KO: 'ko',
    EN: 'en',
    VI: 'vi',
    JA: 'ja'
};
export const DEFAULT_CONFIG = {
    PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    DEFAULT_LANGUAGE: SUPPORTED_LANGUAGES.EN,
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000,
    RATE_LIMIT_WINDOW: 15 * 60 * 1000,
    RATE_LIMIT_MAX_REQUESTS: 100
};
export const JWT_CONFIG = {
    SECRET: process.env.JWT_SECRET || 'creata-mission-jwt-secret-key-2025',
    EXPIRES_IN: '7d',
    ALGORITHM: 'HS256'
};
export const DATABASE_CONFIG = {
    CONNECTION_TIMEOUT: 30000,
    QUERY_TIMEOUT: 15000,
    MAX_CONNECTIONS: 10,
    IDLE_TIMEOUT: 600000
};
export class CreataMissionError extends Error {
    code;
    statusCode;
    constructor(message, code, statusCode = 500) {
        super(message);
        this.name = 'CreataMissionError';
        this.code = code;
        this.statusCode = statusCode;
    }
}
export const REGEX_PATTERNS = {
    ETHEREUM_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
    TRANSACTION_HASH: /^0x[a-fA-F0-9]{64}$/,
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    TELEGRAM_ID: /^[0-9]+$/,
    LANGUAGE_CODE: /^(ko|en|vi|ja)$/
};
