// frontend/src/components/games/CryptoPricePrediction.tsx
// 실제 코인 API를 활용한 암호화폐 가격 예측 게임
// CoinGecko API 연동으로 실시간 가격 데이터 사용

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Clock, Coins, Trophy, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  API_CONFIG, 
  CRYPTO_PREDICTION_CONFIG, 
  ENVIRONMENT_CONFIG,
  getCurrentEnvironment
  } from '../../config/gameConfig';
  
  // Telegram 타입 충돌을 피하기 위해 직접 타입 어션 사용
  interface CustomTelegramWebApp {
    ready?: () => void;
    expand?: () => void;
    initData?: string;
    initDataUnsafe?: any;
    HapticFeedback?: {
      impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
      notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
      selectionChanged: () => void;
    };
  }
  interface CustomTelegram {
    WebApp?: CustomTelegramWebApp;
  }
  
  // 타입 어션 헬퍼 함수
  const getTelegramWebApp = (): CustomTelegramWebApp | undefined => {
    return (window as any)?.Telegram?.WebApp;
  };
  
  // 지원 코인 타입 정의 (CRYPTO_PREDICTION_CONFIG 기준)
type SupportedCoin = 'bitcoin' | 'ethereum' | 'ripple' | 'solana' | 'dogecoin';
type CoinSymbol = 'BTC' | 'ETH' | 'XRP' | 'SOL' | 'DOGE';
type TimerOption = 15 | 30 | 60 | 120;

// 실제 코인 가격 데이터 인터페이스
interface CoinPriceData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_24h: number;
  price_change_percentage_24h?: number;
  sparkline_in_7d?: {
    price: number[];
  };
}

// 게임 상태 인터페이스
interface GameState {
  isActive: boolean;
  isLoading: boolean;
  selectedCoin: SupportedCoin;
  selectedTimer: TimerOption;
  prediction: 'UP' | 'DOWN' | null;
  startPrice: number;
  currentPrice: number;
  timeRemaining: number;
  result: 'WIN' | 'LOSE' | null;
  score: number;
  streak: number;
}

// 사용자 통계 인터페이스
interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  dailyGamesPlayed: number;
  dailyGamesLimit: number;
  currentStreak: number;
  bestStreak: number;
  totalEarnings: number;
}

// 설정에서 암호화폐 정보 추출
const SUPPORTED_COINS = CRYPTO_PREDICTION_CONFIG.CRYPTOCURRENCIES.SUPPORTED;
const DEVELOPMENT_PRICES = CRYPTO_PREDICTION_CONFIG.CRYPTOCURRENCIES.DEVELOPMENT_PRICES;
const CURRENT_ENV = getCurrentEnvironment();

// 코인 심볼 매핑 (설정 기반)
const COIN_MAPPING: Record<SupportedCoin, CoinSymbol> = SUPPORTED_COINS.reduce((acc, coin) => {
  acc[coin.id as SupportedCoin] = coin.symbol as CoinSymbol;
  return acc;
}, {} as Record<SupportedCoin, CoinSymbol>);

// 코인 색상 매핑 (설정 기반)
const coinColors: Record<SupportedCoin, string> = SUPPORTED_COINS.reduce((acc, coin) => {
  acc[coin.id as SupportedCoin] = coin.color;
  return acc;
}, {} as Record<SupportedCoin, string>);

const CryptoPricePrediction: React.FC = () => {
  const { t } = useTranslation();
  
  // 게임 상태 (설정 기반 초기화)
  const [gameState, setGameState] = useState<GameState>({
    isActive: false,
    isLoading: false,
    selectedCoin: CRYPTO_PREDICTION_CONFIG.CRYPTOCURRENCIES.DEFAULT as SupportedCoin,
    selectedTimer: CRYPTO_PREDICTION_CONFIG.DEFAULT_TIMER as TimerOption,
    prediction: null,
    startPrice: 0,
    currentPrice: 0,
    timeRemaining: 0,
    result: null,
    score: 0,
    streak: 0,
  });
  
  // 실제 코인 가격 데이터 상태
  const [coinPrices, setCoinPrices] = useState<Record<SupportedCoin, CoinPriceData>>({} as Record<SupportedCoin, CoinPriceData>);
  const [priceHistory, setPriceHistory] = useState<Record<SupportedCoin, number[]>>({} as Record<SupportedCoin, number[]>);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  
  // useRef로 이전 가격 저장
  const lastPricesRef = useRef<Record<string, number>>({});
  // 코인별 트렌드 저장
  const trendRef = useRef<Record<string, number>>({});
  
  // 사용자 통계 데이터 (하드코딩된 더미 데이터)
  const [userStats, setUserStats] = useState<UserStats>({
    gamesPlayed: 12, // 하드코딩된 게임 횟수
    gamesWon: 8, // 하드코딩된 승리 횟수
    winRate: 66.7, // 하드코딩된 승률
    dailyGamesPlayed: 3, // 하드코딩된 일일 게임 횟수
    dailyGamesLimit: 10, // 하드코딩된 일일 한도
    currentStreak: 2, // 하드코딩된 현재 연승
    bestStreak: 5, // 하드코딩된 최고 연승
    totalEarnings: 1250 // 하드코딩된 총 수익
  });
  
  // API 설정 (설정 기반)
  const API_BASE = CRYPTO_PREDICTION_CONFIG.PRICE_API.BASE_URL;
  const SUPPORTED_COINS_STRING = SUPPORTED_COINS.map(coin => coin.id).join(',');
  const USE_MOCK_DATA = CURRENT_ENV.USE_MOCK_DATA;
  
  // 헬퍼 함수들 (설정 기반)
  const getTrendStrengthByTimer = () => {
    return CRYPTO_PREDICTION_CONFIG.DIFFICULTY.TREND_STRENGTH_BY_TIMER[gameState.selectedTimer] || 0.8;
  };
  
  const getVolatilityByTimer = () => {
    const volatility = CRYPTO_PREDICTION_CONFIG.DIFFICULTY.VOLATILITY_BY_TIMER[gameState.selectedTimer];
    return Math.random() * (volatility.max - volatility.min) + volatility.min;
  };
  
  // 가격 데이터 가져오기 함수
  const fetchPriceData = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let data: Record<string, { usd: number; usd_24h_change: number }>;
      if (USE_MOCK_DATA) {
        // 개발환경: 설정에서 더미 데이터 사용
        data = {};
        Object.entries(DEVELOPMENT_PRICES).forEach(([coin, basePrice]) => {
          // 이전 가격이 있으면 그것을 기준으로, 없으면 기본 가격 사용
          const lastPrice = lastPricesRef.current[coin] || basePrice.usd;
          
          // 트렌드 추가 (상승/하락 추세)
          const trend = Math.random() > 0.5 ? 1 : -1;
          const trendStrength = getTrendStrengthByTimer();
          
          const volatility = getVolatilityByTimer();
          const trendInfluence = Math.random() < trendStrength ? trend : Math.random() > 0.5 ? 1 : -1;
          const priceChange = lastPrice * volatility * trendInfluence;
          const newPrice = Math.max(lastPrice + priceChange, lastPrice * 0.01); // 최소 가격 보장
          
          data[coin] = {
            usd: newPrice,
            usd_24h_change: ((newPrice - basePrice.usd) / basePrice.usd) * 100
          };
          
          // 새 가격을 이전 가격으로 저장
          lastPricesRef.current[coin] = newPrice;
        });
      } else {
        // 실제 API 호출 (프록션에서는 백엔드 프록시 통해)
        // AbortController로 timeout 처리
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CRYPTO_PREDICTION_CONFIG.PRICE_API.TIMEOUT);
        
        try {
          const response = await fetch(
            `${API_BASE}${CRYPTO_PREDICTION_CONFIG.PRICE_API.ENDPOINTS.SIMPLE_PRICE}?ids=${SUPPORTED_COINS_STRING}&vs_currencies=usd&include_24hr_change=true`,
            { signal: controller.signal }
          );
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`API 요청 실패: ${response.status}`);
          }
          
          data = await response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('요청 시간 초과');
          }
          throw error;
        }
        }
        
        // 데이터 변환 및 저장
      const updatedPrices: Record<SupportedCoin, CoinPriceData> = {} as Record<SupportedCoin, CoinPriceData>;
      
      Object.keys(data).forEach((coinId) => {
        const coinData = data[coinId];
        const coinInfo = SUPPORTED_COINS.find(c => c.id === coinId);
        
        updatedPrices[coinId as SupportedCoin] = {
          id: coinId,
          symbol: coinInfo?.symbol || coinId.toUpperCase(),
          name: coinInfo?.name || coinId,
          current_price: coinData.usd || 0,
          price_change_24h: coinData.usd_24h_change || 0,
          price_change_percentage_24h: coinData.usd_24h_change || 0
        };
      });
      
      setCoinPrices(updatedPrices);
      
      // 가격 히스토리 업데이트
      setPriceHistory(prev => {
        const updated = { ...prev };
        Object.keys(updatedPrices).forEach(coinId => {
          const coin = coinId as SupportedCoin;
          const currentPrice = updatedPrices[coin].current_price;
          
          if (!updated[coin]) {
            updated[coin] = [];
          }
          
          updated[coin] = [...updated[coin], currentPrice].slice(-CRYPTO_PREDICTION_CONFIG.CHART.POINT_COUNT);
        });
        return updated;
      });
      
      setError(null);
    } catch (error) {
      console.error('가격 데이터 로드 오류:', error);
      setError('코인 가격 데이터 로드에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [gameState.selectedTimer, USE_MOCK_DATA]);

  // 게임 시작 함수
  const startGame = useCallback(async () => {
    if (gameState.isActive || cooldown > 0) return;
    
    const currentCoinPrice = coinPrices[gameState.selectedCoin];
    if (!currentCoinPrice) {
      toast.error('코인 가격 데이터를 불러오는 중입니다...');
      return;
    }
    
    setGameState(prev => ({
      ...prev,
      isActive: true,
      isLoading: false,
      startPrice: currentCoinPrice.current_price,
      currentPrice: currentCoinPrice.current_price,
      timeRemaining: gameState.selectedTimer,
      prediction: null,
      result: null
    }));
    
    // 텔레그램 햇틱 피드백
    const telegramWebApp = getTelegramWebApp();
    if (telegramWebApp?.HapticFeedback) {
      telegramWebApp.HapticFeedback.impactOccurred('medium');
    }
    
    toast.success(`${gameState.selectedTimer}초 예측 게임 시작!`);
  }, [gameState.isActive, gameState.selectedCoin, gameState.selectedTimer, coinPrices, cooldown]);

  // 예측 제출 함수
  const submitPrediction = useCallback((prediction: 'UP' | 'DOWN') => {
    if (!gameState.isActive || gameState.prediction) return;
    
    setGameState(prev => ({
      ...prev,
      prediction
    }));
    // 텔레그램 햇틱 피드백
    const telegramWebApp = getTelegramWebApp();
    if (telegramWebApp?.HapticFeedback) {
      telegramWebApp.HapticFeedback.selectionChanged();
    }
    
    toast.success(`${prediction === 'UP' ? '상승' : '하락'} 예측 완료!`);
  }, [gameState.isActive, gameState.prediction]);

  // 게임 종료 및 결과 처리
  const endGame = useCallback(async () => {
    if (!gameState.isActive || !gameState.prediction) return;
    
    const currentCoinPrice = coinPrices[gameState.selectedCoin];
    if (!currentCoinPrice) return;
    
    const finalPrice = currentCoinPrice.current_price;
    const priceChange = finalPrice - gameState.startPrice;
    const isWin = (gameState.prediction === 'UP' && priceChange > 0) || 
                  (gameState.prediction === 'DOWN' && priceChange < 0);
    
    const baseScore = CRYPTO_PREDICTION_CONFIG.SCORE.CORRECT_PREDICTION;
    const timeMultiplier = CRYPTO_PREDICTION_CONFIG.SCORE.TIME_BONUS_MULTIPLIER[gameState.selectedTimer] || 1.0;
    const streakBonus = isWin ? CRYPTO_PREDICTION_CONFIG.SCORE.STREAK_BONUS * (gameState.streak + 1) : 0;
    const totalScore = isWin ? Math.round(baseScore * timeMultiplier + streakBonus) : 0;
    
    setGameState(prev => ({
      ...prev,
      isActive: false,
      currentPrice: finalPrice,
      result: isWin ? 'WIN' : 'LOSE',
      score: prev.score + totalScore,
      streak: isWin ? prev.streak + 1 : 0
    }));
    
    // 사용자 통계 업데이트
    setUserStats(prev => ({
      ...prev,
      gamesPlayed: prev.gamesPlayed + 1,
      gamesWon: isWin ? prev.gamesWon + 1 : prev.gamesWon,
      winRate: ((isWin ? prev.gamesWon + 1 : prev.gamesWon) / (prev.gamesPlayed + 1)) * 100,
      currentStreak: isWin ? prev.currentStreak + 1 : 0,
      bestStreak: isWin ? Math.max(prev.bestStreak, prev.currentStreak + 1) : prev.bestStreak,
      totalEarnings: prev.totalEarnings + totalScore
    }));
    
    // 게임 결과 서버에 전송
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SUBMIT_SCORE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: CURRENT_ENV.MOCK_WALLET_ADDRESS || 'demo', // 개발환경에서는 더미 주소 사용
          gameType: 'crypto_prediction',
          round: Date.now(),
          score: totalScore,
          result: {
            coin: gameState.selectedCoin,
            timer: gameState.selectedTimer,
            prediction: gameState.prediction,
            startPrice: gameState.startPrice,
            finalPrice: finalPrice,
            isWin: isWin
          }
        })
      });
      
      if (!response.ok) {
        console.warn('점수 전송 실패:', response.status);
      }
    } catch (error) {
      console.warn('점수 전송 오류:', error);
    }
    
    // 텔레그램 햇틱 피드백
    const telegramWebApp = getTelegramWebApp();
    if (telegramWebApp?.HapticFeedback) {
      telegramWebApp.HapticFeedback.notificationOccurred(isWin ? 'success' : 'error');
    }
    // 결과 메시지
    if (isWin) {
      toast.success(`🎉 정답! +${totalScore}점`);
    } else {
      toast.error('😞 아쉽게 틀렸습니다!');
    }
    
    // 쿨다운 시작
    setCooldown(3);
    const cooldownInterval = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
  }, [gameState, coinPrices]);

  // 타이머 카운트다운
  useEffect(() => {
    if (!gameState.isActive || gameState.timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setGameState(prev => {
        if (prev.timeRemaining <= 1) {
          // 타이머 종료 - 게임 종료 처리
          setTimeout(() => endGame(), 100);
          return { ...prev, timeRemaining: 0 };
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState.isActive, gameState.timeRemaining, endGame]);

  // 가격 데이터 주기적 업데이트
  useEffect(() => {
    fetchPriceData();
    
    const updateInterval = setInterval(() => {
      fetchPriceData();
    }, CRYPTO_PREDICTION_CONFIG.PRICE_API.UPDATE_INTERVAL);

    return () => clearInterval(updateInterval);
  }, [fetchPriceData]);

  // 현재 코인 정보
  const currentCoin = coinPrices[gameState.selectedCoin];
  const coinColor = coinColors[gameState.selectedCoin] || '#6366f1';
  const priceChangePercent = currentCoin?.price_change_percentage_24h || 0;
  const isPositiveChange = priceChangePercent >= 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* 헤더 */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Crypto Price Prediction
          </h1>
          <p className="text-slate-400 text-sm">
            암호화폐 가격 방향을 예측하세요
          </p>
        </div>

        {/* 사용자 통계 */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-green-400">{userStats.gamesWon}</div>
              <div className="text-xs text-slate-400">승리</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-400">{userStats.winRate.toFixed(1)}%</div>
              <div className="text-xs text-slate-400">승률</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-400">{userStats.currentStreak}</div>
              <div className="text-xs text-slate-400">연승</div>
            </div>
          </div>
        </div>

        {/* 코인 및 타이머 선택 */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-4">
          
          {/* 코인 선택 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              암호화폐 선택
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SUPPORTED_COINS.map((coin) => (
                <button
                  key={coin.id}
                  onClick={() => setGameState(prev => ({ ...prev, selectedCoin: coin.id as SupportedCoin }))}
                  disabled={gameState.isActive}
                  className={`p-2 rounded-lg text-xs font-medium transition-all ${
                    gameState.selectedCoin === coin.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  } ${gameState.isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {coin.symbol}
                </button>
              ))}
            </div>
          </div>

          {/* 타이머 선택 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              예측 시간
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CRYPTO_PREDICTION_CONFIG.GAME_DURATION.map((duration) => (
                <button
                  key={duration}
                  onClick={() => setGameState(prev => ({ ...prev, selectedTimer: duration as TimerOption }))}
                  disabled={gameState.isActive}
                  className={`p-2 rounded-lg text-xs font-medium transition-all ${
                    gameState.selectedTimer === duration
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  } ${gameState.isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {duration}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 현재 가격 정보 */}
        {currentCoin && (
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: coinColor }}
                />
                <span className="font-medium">{currentCoin.symbol}</span>
                <span className="text-slate-400 text-sm">{currentCoin.name}</span>
              </div>
              <div className={`flex items-center space-x-1 text-sm ${
                isPositiveChange ? 'text-green-400' : 'text-red-400'
              }`}>
                {isPositiveChange ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span>{priceChangePercent.toFixed(2)}%</span>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: coinColor }}>
                ${currentCoin.current_price.toLocaleString(undefined, { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 6 
                })}
              </div>
              {gameState.isActive && (
                <div className="text-sm text-slate-400 mt-1">
                  시작가: ${gameState.startPrice.toLocaleString(undefined, { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 6 
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 게임 컨트롤 */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          
          {!gameState.isActive && !gameState.result && (
            <button
              onClick={startGame}
              disabled={!currentCoin || cooldown > 0 || loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-all disabled:cursor-not-allowed"
            >
              {loading ? '로딩 중...' : cooldown > 0 ? `쿨다운 ${cooldown}초` : '게임 시작'}
            </button>
          )}

          {gameState.isActive && !gameState.prediction && (
            <div className="space-y-3">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 text-slate-300 mb-2">
                  <Clock size={16} />
                  <span>남은 시간: {gameState.timeRemaining}초</span>
                </div>
                <p className="text-sm text-slate-400">
                  {gameState.selectedTimer}초 후 가격이 올라갈까요, 내려갈까요?
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => submitPrediction('UP')}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center space-x-2"
                >
                  <TrendingUp size={20} />
                  <span>UP</span>
                </button>
                <button
                  onClick={() => submitPrediction('DOWN')}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center space-x-2"
                >
                  <TrendingDown size={20} />
                  <span>DOWN</span>
                </button>
              </div>
            </div>
          )}

          {gameState.isActive && gameState.prediction && (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center space-x-2 text-slate-300">
                <Clock size={16} />
                <span>남은 시간: {gameState.timeRemaining}초</span>
              </div>
              
              <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg ${
                gameState.prediction === 'UP' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
              }`}>
                {gameState.prediction === 'UP' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span>예측: {gameState.prediction === 'UP' ? '상승' : '하락'}</span>
              </div>
              
              <p className="text-sm text-slate-400">
                결과를 기다리는 중...
              </p>
            </div>
          )}

          {gameState.result && (
            <div className="text-center space-y-3">
              <div className={`text-xl font-bold ${
                gameState.result === 'WIN' ? 'text-green-400' : 'text-red-400'
              }`}>
                {gameState.result === 'WIN' ? '🎉 정답!' : '😞 틀렸어요'}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">시작가:</span>
                  <span>${gameState.startPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">최종가:</span>
                  <span>${gameState.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">변동률:</span>
                  <span className={
                    gameState.currentPrice > gameState.startPrice ? 'text-green-400' : 'text-red-400'
                  }>
                    {(((gameState.currentPrice - gameState.startPrice) / gameState.startPrice) * 100).toFixed(2)}%
                  </span>
                </div>
                {gameState.result === 'WIN' && (
                  <div className="flex justify-between font-medium text-yellow-400">
                    <span>획득 점수:</span>
                    <span>+{Math.round(CRYPTO_PREDICTION_CONFIG.SCORE.CORRECT_PREDICTION * (CRYPTO_PREDICTION_CONFIG.SCORE.TIME_BONUS_MULTIPLIER[gameState.selectedTimer] || 1.0))}</span>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setGameState(prev => ({ ...prev, result: null }))}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all"
              >
                다시 플레이
              </button>
            </div>
          )}
        </div>

        {/* 점수 및 연승 정보 */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Trophy className="text-yellow-400" size={20} />
              <span className="font-medium">총 점수</span>
            </div>
            <span className="text-xl font-bold text-yellow-400">{gameState.score.toLocaleString()}</span>
          </div>
          
          {gameState.streak > 0 && (
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-400">연승</span>
              <span className="text-green-400 font-medium">{gameState.streak}연승!</span>
            </div>
          )}
        </div>

        {/* 오류 메시지 */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CryptoPricePrediction;