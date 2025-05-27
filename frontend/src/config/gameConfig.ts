// src/config/gameConfig.ts
// 게임별 설정을 중앙 집중 관리하여 하드코딩 제거

// API 엔드포인트 설정
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001',
  ENDPOINTS: {
    VERIFY_WALLET: '/auth/verify-wallet',
    INSTALL_CONFIRM: '/auth/install-confirm',
    SUBMIT_SCORE: '/game/submit',
    GET_RANKING: '/ranking',
    GET_GAME_HISTORY: '/game/history',
    GET_USER_STATS: '/user/stats'
  },
  TIMEOUT: 10000, // 10초
};

// 일반적인 게임 설정
export const GENERAL_GAME_CONFIG = {
  SCORE: {
    SURVIVAL_BONUS_BASE: 10, // 생존 시간당 기본 점수
    POWER_UP_BONUS: 50, // 파워업 획득 점수
    PERFECT_GAME_BONUS: 200, // 무피해 완주 보너스
    COMBO_MULTIPLIER: 1.5, // 연속 성공 시 점수 배율
    STREAK_BONUS: 20, // 연속 성공 보너스
    MAX_STREAK_MULTIPLIER: 5 // 최대 연속 보너스 배율
  },
  TIMING: {
    GAME_PREPARATION_TIME: 3000, // 게임 준비 시간 (3초)
    RESULT_DISPLAY_TIME: 5000, // 결과 표시 시간 (5초)
    COOLDOWN_TIME: 2000 // 게임 간 쿨다운 시간 (2초)
  }
};

// ReverseDarts 게임 설정
export const REVERSE_DARTS_CONFIG = {
  GAME_DURATION: 15000, // 15초
  CANVAS: {
    BASE_WIDTH: 600,  // 모바일에 맞게 너비
    BASE_HEIGHT: 1000, // 세로로 확장
    MAX_MOBILE_HEIGHT: '70vh' // 모바일 최대 높이
  },
  PLAYER: {
    SIZE: 30,
    SPEED: 5,
    INITIAL_X: 300, // 시작 X 위치 (캔버스 중앙)
    INITIAL_Y: 850, // 시작 Y 위치 (하단)
    JUMP_FORCE: 12,
    GRAVITY: 0.8
  },
  PROJECTILE: {
    SIZE: 8,
    SPEED: 2,
    SPAWN_RATE: 0.07, // 생성 확률 (0-1)
    TRAIL_LENGTH: 5,
    COLORS: ['#ff6b6b', '#ff8fab', '#ffa8cc', '#c8a8e9', '#9d8df1'] // 핑크-퍼플 계열
  },
  POWERUP: {
    SPAWN_RATE: 0.005, // 생성 확률 (0-1)
    SPAWN_INTERVAL: 5000, // 최소 생성 간격 (ms)
    TYPES: {
      SHIELD: { color: '#4ade80', duration: 5000 },
      SPEED_BOOST: { color: '#facc15', duration: 3000 },
      SLOW_TIME: { color: '#8b5cf6', duration: 4000 }
    }
  },
  SCORE: {
    SURVIVAL_PER_SECOND: 10, // 초당 생존 점수
    PERFECT_BONUS: 100 // 무피해 완주 보너스
  },
  VISUAL: {
    GRID_SIZE: 50, // 배경 그리드 크기
    NEON_BLUR: 15, // 네온 효과 블러 정도
    TRAIL_ALPHA_DECAY: 0.1 // 궤적 페이드 속도
  }
};

// LazyDerby 게임 설정 (게으른 경마 - 가장 느린 말 맞추기)
export const LAZY_DERBY_CONFIG = {
  GAME_DURATION: 30000, // 30초 경주
  HORSES: {
    COUNT: 5, // 말의 개수
    NAMES: ['Thunder', 'Lightning', 'Storm', 'Wind', 'Breeze'], // 말 이름들
    COLORS: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7'], // 말 색상들
    SPEED_RANGE: [0.5, 3.0], // 속도 범위 (픽셀/프레임)
    MIN_SPEED: 0.5, // 최소 속도
    MAX_SPEED: 3.0, // 최대 속도
    FINISH_LINE: 500, // 결승선 위치
    LANE_SPACING: 60 // 레인 간격
    },
    TRACK: {
    WIDTH: 600,
    HEIGHT: 300,
    LANES: 5,
    LANE_HEIGHT: 50
  },
  BETTING: {
    TIME_LIMIT: 10000, // 10초 베팅 시간
    ODDS_RANGE: [1.2, 5.0] // 배당률 범위
  },
  SCORE: {
    CORRECT_PREDICTION: 150, // 정답 시 점수
    WRONG_PREDICTION: 0, // 오답 시 점수
    STREAK_BONUS: 25 // 연속 정답 보너스
  }
};

// CryptoPricePrediction 게임 설정
export const CRYPTO_PREDICTION_CONFIG = {
  GAME_DURATION: [15, 30, 60, 120], // 가능한 예측 시간 (초)
  DEFAULT_TIMER: 60, // 기본 타이머 설정
  CRYPTOCURRENCIES: {
    DEFAULT: 'bitcoin', // 기본 암호화폐
    SUPPORTED: [
      {
        id: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        color: '#f7931a'
      },
      {
        id: 'ethereum', 
        symbol: 'ETH',
        name: 'Ethereum',
        color: '#627eea'
      },
      {
        id: 'ripple',
        symbol: 'XRP', 
        name: 'XRP',
        color: '#00d4ff'
      },
      {
        id: 'solana',
        symbol: 'SOL',
        name: 'Solana', 
        color: '#9945ff'
      },
      {
        id: 'dogecoin',
        symbol: 'DOGE',
        name: 'Dogecoin',
        color: '#c2a633'
      }
    ],
    // 개발환경용 더미 데이터 (실제 서비스에서는 API에서 가져옴)
    DEVELOPMENT_PRICES: {
      bitcoin: { usd: 108268.00, usd_24h_change: -2.68 },
      ethereum: { usd: 2357.88, usd_24h_change: -1.24 },
      ripple: { usd: 2.35, usd_24h_change: 0.85 },
      solana: { usd: 175.36, usd_24h_change: -3.42 },
      dogecoin: { usd: 0.228351, usd_24h_change: 1.56 }
    }
  },
  PRICE_API: {
    BASE_URL: 'https://api.coingecko.com/api/v3',
    ENDPOINTS: {
      SIMPLE_PRICE: '/simple/price',
      COINS_LIST: '/coins/list'
    },
    UPDATE_INTERVAL: 5000, // 5초마다 가격 업데이트
    RETRY_ATTEMPTS: 3,
    TIMEOUT: 8000
  },
  CHART: {
    POINT_COUNT: 20, // 차트에 표시할 데이터 포인트 수
    UPDATE_INTERVAL: 1000, // 차트 업데이트 간격 (1초)
    Y_AXIS_BUFFER: 0.02 // Y축 여백 (2%)
  },
  SCORE: {
    CORRECT_PREDICTION: 100, // 정답 시 점수
    WRONG_PREDICTION: 0, // 오답 시 점수
    STREAK_BONUS: 20, // 연속 정답 보너스
    TIME_BONUS_MULTIPLIER: {
      15: 2.0,  // 15초 예측 시 2배 점수
      30: 1.5,  // 30초 예측 시 1.5배 점수  
      60: 1.0,  // 60초 예측 시 기본 점수
      120: 0.8  // 120초 예측 시 0.8배 점수
    }
  },
  DIFFICULTY: {
    // 시간대별 변동폭 설정
    VOLATILITY_BY_TIMER: {
      15: { min: 0.005, max: 0.015 }, // 0.5% ~ 1.5%
      30: { min: 0.01, max: 0.025 },  // 1% ~ 2.5%
      60: { min: 0.015, max: 0.035 }, // 1.5% ~ 3.5%
      120: { min: 0.02, max: 0.05 }   // 2% ~ 5%
    },
    // 트렌드 강도 (상승/하락 추세)
    TREND_STRENGTH_BY_TIMER: {
      15: 0.6,  // 60% 트렌드 영향
      30: 0.7,  // 70% 트렌드 영향
      60: 0.8,  // 80% 트렌드 영향
      120: 0.9  // 90% 트렌드 영향
    }
  }
};

// 블록체인 설정
export const BLOCKCHAIN_CONFIG = {
  NETWORK: {
    NAME: 'Catena (CIP-20) Chain Mainnet',
    RPC_URL: process.env.REACT_APP_RPC_URL || 'https://cvm.node.creatachain.com',
    CHAIN_ID: 1000, // 0x3E8
    CURRENCY_SYMBOL: 'CTA',
    BLOCK_EXPLORER: process.env.REACT_APP_BLOCK_EXPLORER || 'https://catena.explorer.creatachain.com'
  },
  WALLET: {
    CREATA_WALLET_ID: 'com.creatawallet',
    SUPPORTED_WALLETS: ['CreataWallet', 'MetaMask'],
    CONNECTION_TIMEOUT: 30000 // 30초
  },
  TOKENS: {
    CTA: {
      ADDRESS: process.env.REACT_APP_CTA_TOKEN_ADDRESS || '0x...', // 실제 CTA 토큰 주소로 교체 필요
      DECIMALS: 18,
      SYMBOL: 'CTA',
      NAME: 'CreataChain Token'
    }
  }
};

// 환경별 설정
export const ENVIRONMENT_CONFIG = {
  DEVELOPMENT: {
    API_BASE_URL: 'http://localhost:3001',
    USE_MOCK_DATA: true,
    ENABLE_DEBUG_LOGS: true,
    MOCK_WALLET_ADDRESS: '0x1234567890abcdef1234567890abcdef12345678'
  },
  PRODUCTION: {
    API_BASE_URL: process.env.REACT_APP_API_BASE_URL || 'https://api.creata-mission.com',
    USE_MOCK_DATA: false,
    ENABLE_DEBUG_LOGS: false,
    MOCK_WALLET_ADDRESS: null
  }
};

// 현재 환경 감지
export const getCurrentEnvironment = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'production' ? ENVIRONMENT_CONFIG.PRODUCTION : ENVIRONMENT_CONFIG.DEVELOPMENT;
};

// 텔레그램 WebApp 설정
export const TELEGRAM_CONFIG = {
  BOT_USERNAME: process.env.REACT_APP_TELEGRAM_BOT_USERNAME || 'CreataMissionBot',
  WEBAPP_URL: process.env.REACT_APP_WEBAPP_URL || 'https://t.me/CreataMissionBot/game',
  THEME: {
    PRIMARY_COLOR: '#8b5cf6',
    SECONDARY_COLOR: '#06b6d4',
    BACKGROUND_COLOR: '#1f2937',
    TEXT_COLOR: '#f9fafb'
  },
  HAPTIC_FEEDBACK: true,
  CLOSE_CONFIRMATION: true
};

// 다국어 설정
export const I18N_CONFIG = {
  DEFAULT_LANGUAGE: 'en',
  SUPPORTED_LANGUAGES: [
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' }
  ],
  FALLBACK_LANGUAGE: 'en',
  NAMESPACE: 'translation'
};

export default {
  API_CONFIG,
  GENERAL_GAME_CONFIG,
  REVERSE_DARTS_CONFIG,
  LAZY_DERBY_CONFIG,
  CRYPTO_PREDICTION_CONFIG,
  BLOCKCHAIN_CONFIG,
  ENVIRONMENT_CONFIG,
  TELEGRAM_CONFIG,
  I18N_CONFIG,
  getCurrentEnvironment
};