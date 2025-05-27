export declare enum GameType {
    BINARY_OPTIONS = "binary",
    LAZY_DERBY = "derby",
    REVERSE_DARTS = "darts"
}
export declare const GAME_METADATA: {
    binary: {
        name: string;
        nameKo: string;
        description: string;
        maxScore: number;
        minScore: number;
        defaultDuration: number;
    };
    derby: {
        name: string;
        nameKo: string;
        description: string;
        maxScore: number;
        minScore: number;
        defaultDuration: number;
    };
    darts: {
        name: string;
        nameKo: string;
        description: string;
        maxScore: number;
        minScore: number;
        defaultDuration: number;
    };
};
export declare const AIRDROP_CONFIG: {
    RANKING_REWARDS: {
        1: string;
        2: string;
        3: string;
        4: string;
        5: string;
    };
    MIN_GAMES_FOR_REWARD: number;
    MIN_SCORE_FOR_REWARD: number;
    BATCH_SIZE: number;
    RETRY_ATTEMPTS: number;
};
export declare const HTTP_STATUS: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly CONFLICT: 409;
    readonly INTERNAL_SERVER_ERROR: 500;
};
export declare const ERROR_MESSAGES: {
    readonly INVALID_WALLET_ADDRESS: "유효하지 않은 지갑 주소입니다.";
    readonly SIGNATURE_VERIFICATION_FAILED: "서명 검증에 실패했습니다.";
    readonly USER_NOT_FOUND: "사용자를 찾을 수 없습니다.";
    readonly INVALID_GAME_TYPE: "지원되지 않는 게임 종류입니다.";
    readonly INVALID_SCORE: "유효하지 않은 점수입니다.";
    readonly GAME_SUBMISSION_FAILED: "게임 결과 제출에 실패했습니다.";
    readonly INSUFFICIENT_BALANCE: "CTA 토큰 잔액이 부족합니다.";
    readonly AIRDROP_FAILED: "에어드랙 전송에 실패했습니다.";
    readonly INVALID_AMOUNT: "유효하지 않은 금액입니다.";
    readonly INTERNAL_ERROR: "내부 서버 오류가 발생했습니다.";
    readonly VALIDATION_ERROR: "입력값 검증에 실패했습니다.";
    readonly DATABASE_ERROR: "데이터베이스 오류가 발생했습니다.";
};
export declare const SUCCESS_MESSAGES: {
    readonly WALLET_VERIFIED: "지갑 인증이 성공적으로 완료되었습니다.";
    readonly WALLET_INSTALLED: "Creata Wallet 설치가 확인되었습니다.";
    readonly GAME_SUBMITTED: "게임 결과가 성공적으로 제출되었습니다.";
    readonly AIRDROP_COMPLETED: "에어드랙이 성공적으로 완료되었습니다.";
    readonly RANKING_UPDATED: "랜킹이 업데이트되었습니다.";
};
export declare const SUPPORTED_LANGUAGES: {
    readonly KO: "ko";
    readonly EN: "en";
    readonly VI: "vi";
    readonly JA: "ja";
};
export declare const DEFAULT_CONFIG: {
    readonly PAGE_SIZE: 20;
    readonly MAX_PAGE_SIZE: 100;
    readonly DEFAULT_LANGUAGE: "en";
    readonly SESSION_TIMEOUT: number;
    readonly RATE_LIMIT_WINDOW: number;
    readonly RATE_LIMIT_MAX_REQUESTS: 100;
};
export declare const JWT_CONFIG: {
    readonly SECRET: string;
    readonly EXPIRES_IN: "7d";
    readonly ALGORITHM: "HS256";
};
export declare const DATABASE_CONFIG: {
    readonly CONNECTION_TIMEOUT: 30000;
    readonly QUERY_TIMEOUT: 15000;
    readonly MAX_CONNECTIONS: 10;
    readonly IDLE_TIMEOUT: 600000;
};
export declare class CreataMissionError extends Error {
    readonly code: string;
    readonly statusCode: number;
    constructor(message: string, code: string, statusCode?: number);
}
export declare const REGEX_PATTERNS: {
    readonly ETHEREUM_ADDRESS: RegExp;
    readonly TRANSACTION_HASH: RegExp;
    readonly EMAIL: RegExp;
    readonly TELEGRAM_ID: RegExp;
    readonly LANGUAGE_CODE: RegExp;
};
