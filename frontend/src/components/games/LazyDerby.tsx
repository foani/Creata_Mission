// LazyDerby.tsx - 게으른 경마 게임 (가장 느린 말 맞추기)
// gameConfig.ts의 설정값을 사용하여 하드코딩 제거

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Trophy,
  Clock,
  Timer,
  Target
} from 'lucide-react';
import toast from 'react-hot-toast';
import { LAZY_DERBY_CONFIG, API_CONFIG } from '../../config/gameConfig';

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

// 타입 어션 헬퍼 함수
const getTelegramWebApp = (): CustomTelegramWebApp | undefined => {
  return (window as any)?.Telegram?.WebApp;
};

// 말 인터페이스
interface Horse {
  id: number;
  name: string;
  color: string;
  position: number;
  speed: number;
  lane: number;
  isFinished: boolean;
}

// 게임 상태 인터페이스
interface GameState {
  isPlaying: boolean;
  isPaused: boolean;
  gameResult: 'none' | 'win' | 'lose';
  score: number;
  timeRemaining: number;
  selectedHorse: number | null;
  isBettingTime: boolean;
  raceFinished: boolean;
  lastPlace: number | null; // 꼴찌 말의 ID
  soundEnabled: boolean;
}

// 게임 통계 인터페이스
interface GameStats {
  totalGames: number;
  gamesWon: number;
  maxScore: number;
  totalScore: number;
  winRate: number;
  bestStreak: number;
  currentStreak: number;
}

const LazyDerby: React.FC = () => {
  const { t } = useTranslation();
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null); // Timer 타입 오류 수정
  
  // 게임 상태 관리
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    isPaused: false,
    gameResult: 'none',
    score: 0,
    timeRemaining: LAZY_DERBY_CONFIG.GAME_DURATION / 1000,
    selectedHorse: null,
    isBettingTime: false,
    raceFinished: false,
    lastPlace: null,
    soundEnabled: true
  });

  // 말들 상태 관리
  const [horses, setHorses] = useState<Horse[]>([]);
  
  // 게임 통계
  const [gameStats, setGameStats] = useState<GameStats>({
    totalGames: 0,
    gamesWon: 0,
    maxScore: 0,
    totalScore: 0,
    winRate: 0,
    bestStreak: 0,
    currentStreak: 0
  });

  // 말들 초기화
  const initializeHorses = useCallback(() => {
    const newHorses: Horse[] = LAZY_DERBY_CONFIG.HORSES.NAMES.map((name, index) => ({
      id: index,
      name,
      color: LAZY_DERBY_CONFIG.HORSES.COLORS[index],
      position: 0,
      speed: Math.random() * (LAZY_DERBY_CONFIG.HORSES.SPEED_RANGE[1] - LAZY_DERBY_CONFIG.HORSES.SPEED_RANGE[0]) + LAZY_DERBY_CONFIG.HORSES.SPEED_RANGE[0],
      lane: index,
      isFinished: false
    }));
    setHorses(newHorses);
    return newHorses;
  }, []);

  // 게임 시작
  const startGame = useCallback(() => {
    initializeHorses();
    setGameState({
      isPlaying: true,
      isPaused: false,
      gameResult: 'none',
      score: 0,
      timeRemaining: LAZY_DERBY_CONFIG.BETTING.TIME_LIMIT / 1000,
      selectedHorse: null,
      isBettingTime: true,
      raceFinished: false,
      lastPlace: null,
      soundEnabled: gameState.soundEnabled
    });
    
    // 텔레그램 햇틱 피드백
    const telegramWebApp = getTelegramWebApp();
    if (telegramWebApp?.HapticFeedback) {
      telegramWebApp.HapticFeedback.impactOccurred('medium');
    }

    toast.success(t('games.lazyDerby.gameStarted') || 'Game Started!');
  }, [initializeHorses, gameState.soundEnabled, t]);

  // 말 선택
  const selectHorse = useCallback((horseId: number) => {
    if (!gameState.isBettingTime || gameState.selectedHorse !== null) return;
    
    setGameState(prev => ({ ...prev, selectedHorse: horseId }));
    
    // 텔래그램 햇틱 피드백
    const telegramWebApp = getTelegramWebApp();
    if (telegramWebApp?.HapticFeedback) {
      telegramWebApp.HapticFeedback.selectionChanged();
    }
    
    toast.success(t('games.lazyDerby.horseSelected', { horseName: LAZY_DERBY_CONFIG.HORSES.NAMES[horseId] }) || `Selected ${LAZY_DERBY_CONFIG.HORSES.NAMES[horseId]}!`);
  }, [gameState.isBettingTime, gameState.selectedHorse, t]);

  // 경주 시작
  const startRace = useCallback(() => {
    if (gameState.selectedHorse === null) {
      toast.error(t('games.lazyDerby.selectHorseFirst') || 'Please select a horse first!');
      return;
    }
    
    setGameState(prev => ({ 
      ...prev, 
      isBettingTime: false,
      timeRemaining: LAZY_DERBY_CONFIG.GAME_DURATION / 1000
    }));
    
    // 텔래그램 햇틱 피드백
    const telegramWebApp = getTelegramWebApp();
    if (telegramWebApp?.HapticFeedback) {
      telegramWebApp.HapticFeedback.impactOccurred('heavy');
    }
    
    toast.success(t('games.lazyDerby.raceStarted') || 'Race Started!');
  }, [gameState.selectedHorse, t]);

  // 게임 일시정지/재개
  const togglePause = useCallback(() => {
    if (!gameState.isPlaying) return;
    
    setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
    
    // 텔래그램 햇틱 피드백
    const telegramWebApp = getTelegramWebApp();
    if (telegramWebApp?.HapticFeedback) {
      telegramWebApp.HapticFeedback.impactOccurred('light');
    }
  }, [gameState.isPlaying]);

  // 게임 리셋
  const resetGame = useCallback(() => {
    setGameState({
      isPlaying: false,
      isPaused: false,
      gameResult: 'none',
      score: 0,
      timeRemaining: LAZY_DERBY_CONFIG.GAME_DURATION / 1000,
      selectedHorse: null,
      isBettingTime: false,
      raceFinished: false,
      lastPlace: null,
      soundEnabled: gameState.soundEnabled
    });
    setHorses([]);
    
    // 게임 루프 정리
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
    }
    
    // 텔래그램 햇틱 피드백
    const telegramWebApp = getTelegramWebApp();
    if (telegramWebApp?.HapticFeedback) {
      telegramWebApp.HapticFeedback.impactOccurred('medium');
    }
    
    toast.success(t('games.lazyDerby.gameReset') || 'Game Reset!');
  }, [gameState.soundEnabled, t]);

  // 게임 결과 처리
  const handleGameEnd = useCallback(async (isWon: boolean, finalScore: number) => {
    setGameState(prev => ({ 
      ...prev, 
      gameResult: isWon ? 'win' : 'lose',
      isPlaying: false,
      raceFinished: true 
    }));
    
    // 통계 업데이트
    setGameStats(prev => {
      const newStats = {
        ...prev,
        totalGames: prev.totalGames + 1,
        gamesWon: isWon ? prev.gamesWon + 1 : prev.gamesWon,
        maxScore: Math.max(prev.maxScore, finalScore),
        totalScore: prev.totalScore + finalScore,
        currentStreak: isWon ? prev.currentStreak + 1 : 0,
        bestStreak: isWon ? Math.max(prev.bestStreak, prev.currentStreak + 1) : prev.bestStreak
      };
      newStats.winRate = (newStats.gamesWon / newStats.totalGames) * 100;
      return newStats;
    });
    
    // 텔래그램 햇틱 피드백
    const telegramWebApp = getTelegramWebApp();
    if (telegramWebApp?.HapticFeedback) {
      telegramWebApp.HapticFeedback.notificationOccurred(isWon ? 'success' : 'error');
    }
    
    // 게임 결과를 서버에 전송 (API_CONFIG 사용)
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SUBMIT_SCORE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gameType: 'lazyDerby',
          score: finalScore,
          result: {
            selectedHorse: gameState.selectedHorse,
            lastPlace: gameState.lastPlace,
            isWon
          }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit score');
      }
      
      const data = await response.json();
      console.log('Score submitted successfully:', data);
    } catch (error) {
      console.error('Error submitting score:', error);
      toast.error(t('games.common.scoreSubmitError') || 'Failed to submit score');
    }
    
    const message = isWon 
      ? t('games.lazyDerby.gameWon', { score: finalScore }) || `You Won! Score: ${finalScore}`
      : t('games.lazyDerby.gameLost') || 'Better luck next time!';
    
    setTimeout(() => {
      toast[isWon ? 'success' : 'error'](message);
    }, 100);
  }, [gameState.selectedHorse, gameState.lastPlace, t]);

  // 경주 시뮬레이션
  const updateRace = useCallback(() => {
    if (gameState.isPaused || gameState.isBettingTime || gameState.raceFinished) return;
    
    setHorses(prevHorses => {
      const updatedHorses = prevHorses.map(horse => {
        if (horse.isFinished) return horse;
        
        const newPosition = horse.position + horse.speed;
        const isFinished = newPosition >= LAZY_DERBY_CONFIG.HORSES.FINISH_LINE;
        
        return {
          ...horse,
          position: Math.min(newPosition, LAZY_DERBY_CONFIG.HORSES.FINISH_LINE),
          isFinished
        };
      });
      
      // 모든 말이 결승선에 도달했는지 확인
      const allFinished = updatedHorses.every(horse => horse.isFinished);
      
      if (allFinished && !gameState.raceFinished) {
        // 순위 결정 (가장 느린 말 = 꼴찌 찾기)
        const sortedHorses = [...updatedHorses].sort((a, b) => a.position - b.position);
        const lastPlaceHorse = sortedHorses[0]; // 가장 적게 이동한 말
        
        const isWon = gameState.selectedHorse === lastPlaceHorse.id;
        const finalScore = isWon ? LAZY_DERBY_CONFIG.SCORE.CORRECT_PREDICTION : LAZY_DERBY_CONFIG.SCORE.WRONG_PREDICTION;
        
        setGameState(prev => ({ 
          ...prev, 
          lastPlace: lastPlaceHorse.id,
          score: finalScore 
        }));
        
        // 게임 종료 처리
        setTimeout(() => {
          handleGameEnd(isWon, finalScore);
        }, 1000);
      }
      
      return updatedHorses;
    });
  }, [gameState.isPaused, gameState.isBettingTime, gameState.raceFinished, gameState.selectedHorse, handleGameEnd]);

  // 게임 루프
  useEffect(() => {
    if (gameState.isPlaying && !gameState.isPaused && !gameState.isBettingTime) {
      const interval = setInterval(() => {
        updateRace();
        
        setGameState(prev => {
          const newTimeRemaining = prev.timeRemaining - 0.1;
          
          if (newTimeRemaining <= 0) {
            // 시간 초과
            handleGameEnd(false, 0);
            return { ...prev, timeRemaining: 0 };
          }
          
          return { ...prev, timeRemaining: newTimeRemaining };
        });
      }, 100); // 100ms마다 업데이트
      
      gameLoopRef.current = interval;
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [gameState.isPlaying, gameState.isPaused, gameState.isBettingTime, updateRace, handleGameEnd]);

  // 베팅 시간 타이머
  useEffect(() => {
    if (gameState.isBettingTime) {
      const interval = setInterval(() => {
        setGameState(prev => {
          const newTimeRemaining = prev.timeRemaining - 0.1;
          
          if (newTimeRemaining <= 0) {
            // 베팅 시간 종료, 자동으로 경주 시작
            startRace();
            return { ...prev, timeRemaining: 0 };
          }
          
          return { ...prev, timeRemaining: newTimeRemaining };
        });
      }, 100);
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [gameState.isBettingTime, startRace]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 rounded-xl shadow-2xl">
      {/* 게임 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <h2 className="text-2xl font-bold text-white">
              {t('games.lazyDerby.title') || '🐎 Lazy Derby'}
            </h2>
          </div>
          <div className="text-sm text-green-200">
            {t('games.lazyDerby.subtitle') || 'Pick the Slowest Horse!'}
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setGameState(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
            className="p-2 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors"
          >
            {gameState.soundEnabled ? (
              <Volume2 className="w-5 h-5 text-white" />
            ) : (
              <VolumeX className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* 게임 정보 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-400">{gameState.score}</div>
          <div className="text-xs text-white/70">{t('games.common.score') || 'Score'}</div>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">
            {Math.ceil(gameState.timeRemaining)}s
          </div>
          <div className="text-xs text-white/70">{t('games.common.timeLeft') || 'Time Left'}</div>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{gameStats.gamesWon}</div>
          <div className="text-xs text-white/70">{t('games.common.wins') || 'Wins'}</div>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">
            {gameStats.winRate.toFixed(1)}%
          </div>
          <div className="text-xs text-white/70">{t('games.common.winRate') || 'Win Rate'}</div>
        </div>
      </div>

      {/* 게임 영역 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 mb-6">
        {!gameState.isPlaying ? (
          // 시작 화면
          <div className="text-center">
            <div className="mb-8">
              <div className="text-6xl mb-4">🐎</div>
              <h3 className="text-2xl font-bold text-white mb-2">
                {t('games.lazyDerby.welcome') || 'Welcome to Lazy Derby!'}
              </h3>
              <p className="text-white/70 mb-6">
                {t('games.lazyDerby.instruction') || 'Choose the horse you think will finish LAST!'}
              </p>
            </div>
            
            <button
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              <Play className="w-5 h-5 inline mr-2" />
              {t('games.common.startGame') || 'Start Game'}
            </button>
          </div>
        ) : (
          // 게임 진행 화면
          <div>
            {gameState.isBettingTime ? (
              // 베팅 시간
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">
                  {t('games.lazyDerby.selectHorse') || 'Select the Slowest Horse!'}
                </h3>
                <p className="text-white/70 mb-4">
                  {t('games.lazyDerby.bettingTime', { time: Math.ceil(gameState.timeRemaining) }) || `Betting time: ${Math.ceil(gameState.timeRemaining)}s`}
                </p>
              </div>
            ) : (
              // 경주 진행 중
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">
                  {t('games.lazyDerby.raceInProgress') || 'Race in Progress!'}
                </h3>
                {gameState.selectedHorse !== null && (
                  <p className="text-white/70">
                    {t('games.lazyDerby.yourPick', { horseName: LAZY_DERBY_CONFIG.HORSES.NAMES[gameState.selectedHorse] }) || `You picked: ${LAZY_DERBY_CONFIG.HORSES.NAMES[gameState.selectedHorse]}`}
                  </p>
                )}
              </div>
            )}

            {/* 경마장 */}
            <div className="bg-gradient-to-b from-green-600 to-green-700 rounded-lg p-4 mb-4">
              <div className="bg-brown-600 rounded p-4" style={{ backgroundColor: '#8B4513' }}>
                {horses.map((horse) => (
                  <div key={horse.id} className="relative mb-3 last:mb-0">
                    {/* 트랙 */}
                    <div className="h-12 bg-gradient-to-r from-yellow-800 to-yellow-700 rounded-lg relative overflow-hidden">
                      {/* 결승선 */}
                      <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/50" />
                      
                      {/* 말 */}
                      <motion.div
                        className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold cursor-pointer ${
                          gameState.selectedHorse === horse.id ? 'ring-4 ring-yellow-400' : ''
                        } ${gameState.isBettingTime ? 'hover:scale-110' : ''}`}
                        style={{ 
                          backgroundColor: horse.color,
                          left: `${Math.min((horse.position / LAZY_DERBY_CONFIG.HORSES.FINISH_LINE) * 90, 90)}%`,
                          transition: 'left 0.1s ease-out'
                        }}
                        onClick={() => gameState.isBettingTime && selectHorse(horse.id)}
                        whileHover={gameState.isBettingTime ? { scale: 1.1 } : {}}
                        whileTap={gameState.isBettingTime ? { scale: 0.95 } : {}}
                      >
                        🐎
                      </motion.div>
                      
                      {/* 말 이름 */}
                      <div className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white text-xs font-bold pointer-events-none">
                        {horse.name}
                      </div>
                      
                      {/* 속도 표시 (베팅 시간에만) */}
                      {gameState.isBettingTime && (
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white text-xs">
                          {'⭐'.repeat(Math.ceil(horse.speed))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 컨트롤 버튼 */}
            <div className="flex justify-center space-x-3">
              {gameState.isBettingTime && gameState.selectedHorse !== null && (
                <button
                  onClick={startRace}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105"
                >
                  <Timer className="w-4 h-4 inline mr-2" />
                  {t('games.lazyDerby.startRace') || 'Start Race'}
                </button>
              )}
              
              {!gameState.isBettingTime && (
                <button
                  onClick={togglePause}
                  className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all duration-200"
                >
                  {gameState.isPaused ? (
                    <Play className="w-4 h-4 inline mr-2" />
                  ) : (
                    <Pause className="w-4 h-4 inline mr-2" />
                  )}
                  {gameState.isPaused ? (t('games.common.resume') || 'Resume') : (t('games.common.pause') || 'Pause')}
                </button>
              )}
              
              <button
                onClick={resetGame}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200"
              >
                <RotateCcw className="w-4 h-4 inline mr-2" />
                {t('games.common.reset') || 'Reset'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 게임 결과 */}
      <AnimatePresence>
        {gameState.gameResult !== 'none' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={resetGame}
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              className="bg-gradient-to-br from-white to-gray-100 rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`text-6xl mb-4 ${gameState.gameResult === 'win' ? 'animate-bounce' : ''}`}>
                {gameState.gameResult === 'win' ? '🏆' : '😔'}
              </div>
              
              <h3 className={`text-2xl font-bold mb-4 ${
                gameState.gameResult === 'win' ? 'text-green-600' : 'text-red-600'
              }`}>
                {gameState.gameResult === 'win' 
                  ? (t('games.lazyDerby.youWon') || 'You Won!') 
                  : (t('games.lazyDerby.youLost') || 'You Lost!')}
              </h3>
              
              <div className="space-y-2 mb-6 text-gray-700">
                <p>{t('games.common.finalScore') || 'Final Score'}: <span className="font-bold text-blue-600">{gameState.score}</span></p>
                {gameState.lastPlace !== null && (
                  <>
                    <p>{t('games.lazyDerby.slowestHorse') || 'Slowest Horse'}: <span className="font-bold">{LAZY_DERBY_CONFIG.HORSES.NAMES[gameState.lastPlace]}</span></p>
                    {gameState.selectedHorse !== null && (
                      <p>{t('games.lazyDerby.yourSelection') || 'Your Selection'}: <span className="font-bold">{LAZY_DERBY_CONFIG.HORSES.NAMES[gameState.selectedHorse]}</span></p>
                    )}
                  </>
                )}
              </div>
              
              <button
                onClick={resetGame}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                {t('games.common.playAgain') || 'Play Again'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 게임 통계 */}
      {gameStats.totalGames > 0 && (
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4">
          <h4 className="text-lg font-bold text-white mb-3">
            {t('games.common.statistics') || 'Statistics'}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-blue-400">{gameStats.totalGames}</div>
              <div className="text-xs text-white/70">{t('games.common.totalGames') || 'Total Games'}</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-400">{gameStats.gamesWon}</div>
              <div className="text-xs text-white/70">{t('games.common.wins') || 'Wins'}</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-400">{gameStats.maxScore}</div>
              <div className="text-xs text-white/70">{t('games.common.bestScore') || 'Best Score'}</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-400">{gameStats.bestStreak}</div>
              <div className="text-xs text-white/70">{t('games.common.bestStreak') || 'Best Streak'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LazyDerby;