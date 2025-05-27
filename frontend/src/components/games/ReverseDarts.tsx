// ReverseDarts.tsx - 네온 스타일의 화살 피하기 게임
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Clock, Heart, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  REVERSE_DARTS_CONFIG,
  API_CONFIG,
  GENERAL_GAME_CONFIG 
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

// 타입 어션 헬퍼 함수
const getTelegramWebApp = (): CustomTelegramWebApp | undefined => {
  return (window as any)?.Telegram?.WebApp;
};

// 게임 설정 상수 (설정 파일에서 가져옴)
const GAME_CONFIG = {
  GAME_DURATION: REVERSE_DARTS_CONFIG.GAME_DURATION,
  BASE_CANVAS_WIDTH: REVERSE_DARTS_CONFIG.CANVAS.BASE_WIDTH,
  BASE_CANVAS_HEIGHT: REVERSE_DARTS_CONFIG.CANVAS.BASE_HEIGHT,
  CANVAS_WIDTH: REVERSE_DARTS_CONFIG.CANVAS.BASE_WIDTH,
  CANVAS_HEIGHT: REVERSE_DARTS_CONFIG.CANVAS.BASE_HEIGHT,
  PLAYER_SIZE: REVERSE_DARTS_CONFIG.PLAYER.SIZE,
  ARROW_SIZE: REVERSE_DARTS_CONFIG.PROJECTILE.SIZE,
  ARROW_SPEED: REVERSE_DARTS_CONFIG.PROJECTILE.SPEED,
  ARROW_SPAWN_RATE: REVERSE_DARTS_CONFIG.PROJECTILE.SPAWN_RATE,
  POWER_UP_SPAWN_RATE: REVERSE_DARTS_CONFIG.POWERUP.SPAWN_RATE
};

// 타입 정의
interface Player {
  x: number;
  y: number;
  size: number;
  invincible: boolean;
  shield: boolean;
  health: number;
}

interface Arrow {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  size: number;
  type: 'normal' | 'fire' | 'ice' | 'lightning' | 'homing';
  damage: number;
}

interface PowerUp {
  id: string;
  x: number;
  y: number;
  size: number;
  type: 'shield' | 'health' | 'slow' | 'invincible';
  duration: number;
  collected: boolean;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface GameState {
  isPlaying: boolean;
  isPaused: boolean;
  timeRemaining: number;
  score: number;
  combo: number;
  maxCombo: number;
  difficulty: 'NORMAL';
  gameResult: 'none' | 'win' | 'lose';
  soundEnabled: boolean;
}

interface GameStats {
  totalGames: number;
  gamesWon: number;
  maxScore: number;
  maxCombo: number;
  totalSurvivalTime: number;
  averageSurvivalTime: number;
  winRate: number;
}

// 초기 상태
const initialPlayer: Player = {
  x: GAME_CONFIG.CANVAS_WIDTH / 2,
  y: GAME_CONFIG.CANVAS_HEIGHT * 0.8, // 모바일에서 좋은 조작을 위해 하단에 배치
  size: GAME_CONFIG.PLAYER_SIZE,
  invincible: false,
  shield: false,
  health: 3
};

const initialGameState: GameState = {
  isPlaying: false,
  isPaused: false,
  timeRemaining: GAME_CONFIG.GAME_DURATION,
  score: 0,
  combo: 0,
  maxCombo: 0,
  difficulty: 'NORMAL',
  gameResult: 'none',
  soundEnabled: true
};

const initialStats: GameStats = {
  totalGames: 0,
  gamesWon: 0,
  maxScore: 0,
  maxCombo: 0,
  totalSurvivalTime: 0,
  averageSurvivalTime: 0,
  winRate: 0
};
// 메인 컴포넌트
const ReverseDarts: React.FC = () => {
  const { t } = useTranslation();
  
  // 게임 상태
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [player, setPlayer] = useState<Player>(initialPlayer);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [stats, setStats] = useState<GameStats>(initialStats);
  
  // 키 입력 상태
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({});
  
  // 터치 조작 상태
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchControls, setTouchControls] = useState({
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false
  });
  
  // 반응형 캔버스 크기 상태
  const [canvasSize, setCanvasSize] = useState({
    width: GAME_CONFIG.BASE_CANVAS_WIDTH,
    height: GAME_CONFIG.BASE_CANVAS_HEIGHT
  });
  
  // refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // 사운드 재생 함수
  const playSound = useCallback((soundName: string) => {
    if (!gameState.soundEnabled) return;
    
    try {
      const audio = new Audio(`/sounds/${soundName}.mp3`);
      audio.volume = 0.3;
      audio.play().catch(err => {
        console.log('사운드 재생 실패:', err);
      });
    } catch (error) {
      console.log('사운드 로드 실패:', error);
    }
  }, [gameState.soundEnabled]);

  // 반응형 캔버스 크기 조정 함수
  const updateCanvasSize = useCallback(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const maxWidth = Math.min(containerRect.width - 40, window.innerWidth - 40);
    const maxHeight = Math.min(containerRect.height - 200, window.innerHeight - 200);
    
    const aspectRatio = GAME_CONFIG.BASE_CANVAS_WIDTH / GAME_CONFIG.BASE_CANVAS_HEIGHT;
    let newWidth = Math.min(maxWidth, GAME_CONFIG.BASE_CANVAS_WIDTH);
    let newHeight = newWidth / aspectRatio;
    
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = newHeight * aspectRatio;
    }
    
    newWidth = Math.max(400, newWidth);   // 모바일에 맞게 최소 너비 조정
    newHeight = Math.max(500, newHeight); // 세로 비율에 맞게 최소 높이 조정
    
    setCanvasSize({ width: newWidth, height: newHeight });
    
    GAME_CONFIG.CANVAS_WIDTH = newWidth;
    GAME_CONFIG.CANVAS_HEIGHT = newHeight;
  }, []);
  // 게임 시작
  const startGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      timeRemaining: GAME_CONFIG.GAME_DURATION,
      score: 0,
      combo: 0,
      gameResult: 'none'
    }));
    setPlayer(initialPlayer);
    setArrows([]);
    setPowerUps([]);
    setParticles([]);
    playSound('game_start');
    
    // 텔레그램 햇틱 피드백
    const telegramWebApp = getTelegramWebApp();
    if (telegramWebApp?.HapticFeedback) {
      telegramWebApp.HapticFeedback.impactOccurred('medium');
    }
    
    toast.success('게임 시작! 화살을 피하세요!');
    }, [playSound]);

  // 게임 일시정지
  const togglePause = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isPaused: !prev.isPaused
    }));
  }, []);

  // 게임 재시작
  const resetGame = useCallback(() => {
    setGameState(initialGameState);
    setPlayer(initialPlayer);
    setArrows([]);
    setPowerUps([]);
    setParticles([]);
  }, []);

  // 게임 종료
  const endGame = useCallback((won: boolean) => {
    const survivedTime = GAME_CONFIG.GAME_DURATION - gameState.timeRemaining;
    const finalScore = won ? 200 + gameState.score : Math.floor(survivedTime / 100);
    
    setGameState(prev => ({
      ...prev,
      isPlaying: false,
      gameResult: won ? 'win' : 'lose',
      score: finalScore
    }));
    
    // 통계 업데이트
    setStats(prev => {
      const newTotalGames = prev.totalGames + 1;
      const newGamesWon = won ? prev.gamesWon + 1 : prev.gamesWon;
      const newTotalSurvivalTime = prev.totalSurvivalTime + survivedTime;
      
      return {
        ...prev,
        totalGames: newTotalGames,
        gamesWon: newGamesWon,
        maxScore: Math.max(prev.maxScore, finalScore),
        maxCombo: Math.max(prev.maxCombo, gameState.maxCombo),
        totalSurvivalTime: newTotalSurvivalTime,
        averageSurvivalTime: newTotalSurvivalTime / newTotalGames,
        winRate: (newGamesWon / newTotalGames) * 100
      };
    });
    
    playSound(won ? 'game_win' : 'game_over');
    
    // 텔레그램 햇틱 피드백
    const telegramWebApp = getTelegramWebApp();
    if (telegramWebApp?.HapticFeedback) {
      telegramWebApp.HapticFeedback.notificationOccurred(won ? 'success' : 'error');
    }
    
    // 점수 전송 시도 (비동기로 처리)
    if (won) {
      (async () => {
        try {
          const response = await fetch(`${API_CONFIG.BASE_URL}/game/submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              walletAddress: 'demo-wallet-address', // 하드코딩된 데모 지갑 주소
              gameType: 'reverse-darts',
              round: Math.floor(Date.now() / 1000),
              score: finalScore,
              result: {
                won,
                survivalTime: survivedTime,
                perfect: won && gameState.score > 0
              }
            }),
          });
          
          if (!response.ok) {
            console.warn('점수 전송 실패:', response.status);
          }
        } catch (error) {
          console.warn('점수 전송 오류:', error);
        }
      })();
    }
    
    toast(won ? '🎉 완벽한 생존! 승리!' : '💥 게임 오버!');
    }, [gameState, playSound]);
  // 화살 생성 함수
  const createArrow = useCallback(() => {
    // 모바일 세로 화면에 맞게 화살 생성 방향 조정
    // 위쪽 60%, 좌우 30%, 아래쪽 10%
    const rand = Math.random();
    const side = rand < 0.6 ? 0 : // 위쪽 60%
                 rand < 0.85 ? (Math.random() < 0.5 ? 1 : 3) : // 좌우 25%
                 2; // 아래쪽 15%
    const arrowTypes = ['normal', 'fire', 'ice', 'lightning', 'homing'] as const;
    const type = arrowTypes[Math.floor(Math.random() * arrowTypes.length)];
    
    let x, y, velocityX, velocityY;
    
    const speedMultiplier = type === 'homing' ? 1.5 : 
                           type === 'lightning' ? 2 : 1;
    
    const baseSpeed = GAME_CONFIG.ARROW_SPEED * speedMultiplier;
    
    switch (side) {
      case 0: // 위쪽에서
        x = Math.random() * GAME_CONFIG.CANVAS_WIDTH;
        y = -GAME_CONFIG.ARROW_SIZE;
        velocityX = (Math.random() - 0.5) * 2;
        velocityY = baseSpeed;
        break;
      case 1: // 오른쪽에서
        x = GAME_CONFIG.CANVAS_WIDTH + GAME_CONFIG.ARROW_SIZE;
        y = Math.random() * GAME_CONFIG.CANVAS_HEIGHT;
        velocityX = -baseSpeed;
        velocityY = (Math.random() - 0.5) * 2;
        break;
      case 2: // 아래쪽에서
        x = Math.random() * GAME_CONFIG.CANVAS_WIDTH;
        y = GAME_CONFIG.CANVAS_HEIGHT + GAME_CONFIG.ARROW_SIZE;
        velocityX = (Math.random() - 0.5) * 2;
        velocityY = -baseSpeed;
        break;
      default: // 왼쪽에서
        x = -GAME_CONFIG.ARROW_SIZE;
        y = Math.random() * GAME_CONFIG.CANVAS_HEIGHT;
        velocityX = baseSpeed;
        velocityY = (Math.random() - 0.5) * 2;
        break;
    }
    
    return {
      id: `arrow_${Date.now()}_${Math.random()}`,
      x,
      y,
      velocityX,
      velocityY,
      size: GAME_CONFIG.ARROW_SIZE,
      type,
      damage: type === 'normal' ? 1 : 2
    };
  }, []);

  // 파워업 생성 함수
  const createPowerUp = useCallback(() => {
    const types = ['shield', 'health', 'slow', 'invincible'] as const;
    const type = types[Math.floor(Math.random() * types.length)];
    
    return {
      id: `powerup_${Date.now()}_${Math.random()}`,
      x: Math.random() * (GAME_CONFIG.CANVAS_WIDTH - 40) + 20,
      y: Math.random() * (GAME_CONFIG.CANVAS_HEIGHT - 40) + 20,
      size: 15,
      type,
      duration: 3000,
      collected: false
    };
  }, []);

  // 파티클 생성 함수
  const createParticles = useCallback((x: number, y: number, color: string, count: number = 5) => {
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: `particle_${Date.now()}_${i}`,
        x,
        y,
        velocityX: (Math.random() - 0.5) * 4,
        velocityY: (Math.random() - 0.5) * 4,
        life: 30,
        maxLife: 30,
        color,
        size: Math.random() * 4 + 2
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // 충돌 감지 함수
  const checkCollision = useCallback((obj1: {x: number, y: number, size: number}, obj2: {x: number, y: number, size: number}) => {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (obj1.size + obj2.size) / 2;
  }, []);
  // 플레이어 이동 처리
  const updatePlayer = useCallback(() => {
    const speed = 5;
    let newX = player.x;
    let newY = player.y;
    
    // 키보드 조작
    if (keys['ArrowLeft'] || keys['KeyA']) newX -= speed;
    if (keys['ArrowRight'] || keys['KeyD']) newX += speed;
    if (keys['ArrowUp'] || keys['KeyW']) newY -= speed;
    if (keys['ArrowDown'] || keys['KeyS']) newY += speed;
    
    // 터치 조작 추가
    if (touchControls.left) newX -= speed;
    if (touchControls.right) newX += speed;
    if (touchControls.up) newY -= speed;
    if (touchControls.down) newY += speed;
    
    // 경계 체크
    newX = Math.max(player.size / 2, Math.min(GAME_CONFIG.CANVAS_WIDTH - player.size / 2, newX));
    newY = Math.max(player.size / 2, Math.min(GAME_CONFIG.CANVAS_HEIGHT - player.size / 2, newY));
    
    setPlayer(prev => ({ ...prev, x: newX, y: newY }));
  }, [player, keys, touchControls]);

  // 게임 루프 (참조 코드 구조)
  const gameLoop = useCallback((currentTime: number) => {
    if (!gameState.isPlaying || gameState.isPaused) return;
    
    const deltaTime = currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;
    
    // 시간 업데이트
    setGameState(prev => {
      const newTimeRemaining = Math.max(0, prev.timeRemaining - deltaTime);
      
      if (newTimeRemaining <= 0) {
        endGame(true); // 시간이 다 되면 승리
        return prev;
      }
      
      return { ...prev, timeRemaining: newTimeRemaining };
    });
    
    // 플레이어 이동
    updatePlayer();
    
    // 화살 생성
    if (Math.random() < GAME_CONFIG.ARROW_SPAWN_RATE) {
      setArrows(prev => [...prev, createArrow()]);
    }
    
    // 파워업 생성
    if (Math.random() < GAME_CONFIG.POWER_UP_SPAWN_RATE) {
      setPowerUps(prev => [...prev, createPowerUp()]);
    }
    
    // 화살 이동 및 충돌 체크
    setArrows(prev => {
      return prev.filter(arrow => {
        // 호밍 화살 로직
        if (arrow.type === 'homing') {
          const dx = player.x - arrow.x;
          const dy = player.y - arrow.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            const homingForce = 0.05;
            arrow.velocityX += (dx / distance) * homingForce;
            arrow.velocityY += (dy / distance) * homingForce;
          }
        }
        
        arrow.x += arrow.velocityX;
        arrow.y += arrow.velocityY;
        
        // 화면 밖으로 나간 화살 제거
        if (arrow.x < -50 || arrow.x > GAME_CONFIG.CANVAS_WIDTH + 50 ||
            arrow.y < -50 || arrow.y > GAME_CONFIG.CANVAS_HEIGHT + 50) {
          return false;
        }
        
        // 플레이어와 충돌 체크
        if (!player.invincible && checkCollision(player, arrow)) {
          createParticles(arrow.x, arrow.y, '#ff0000');
          playSound('hit');
          
          if (!player.shield) {
            setPlayer(prev => ({ ...prev, health: prev.health - arrow.damage }));
            
            if (player.health - arrow.damage <= 0) {
              endGame(false); // 체력이 0이 되면 패배
            }
          } else {
            setPlayer(prev => ({ ...prev, shield: false }));
          }
          
          return false;
        }
        
        return true;
      });
    });
    
    // 파워업 충돌 체크
    setPowerUps(prev => {
      return prev.filter(powerUp => {
        if (checkCollision(player, powerUp)) {
          createParticles(powerUp.x, powerUp.y, '#00ff00');
          playSound('powerup');
          
          // 파워업 효과 적용
          switch (powerUp.type) {
            case 'shield':
              setPlayer(prev => ({ ...prev, shield: true }));
              break;
            case 'health':
              setPlayer(prev => ({ ...prev, health: Math.min(3, prev.health + 1) }));
              break;
            case 'invincible':
              setPlayer(prev => ({ ...prev, invincible: true }));
              setTimeout(() => {
                setPlayer(prev => ({ ...prev, invincible: false }));
              }, powerUp.duration);
              break;
          }
          
          return false;
        }
        return true;
      });
    });
    
    // 파티클 업데이트
    setParticles(prev => {
      return prev.filter(particle => {
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        particle.life -= 1;
        particle.velocityX *= 0.98;
        particle.velocityY *= 0.98;
        
        return particle.life > 0;
      });
    });
    
  }, [gameState, player, keys, checkCollision, createArrow, createPowerUp, createParticles, updatePlayer, endGame, playSound]);
  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    setKeys(prev => ({ ...prev, [event.code]: true }));
    
    // 게임 제어 키
    if (event.code === 'Space' && !gameState.isPlaying) {
      event.preventDefault();
      startGame();
    } else if (event.code === 'KeyP' && gameState.isPlaying) {
      event.preventDefault();
      togglePause();
    } else if (event.code === 'KeyR') {
      event.preventDefault();
      resetGame();
    }
  }, [gameState.isPlaying, startGame, togglePause, resetGame]);
  
  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    setKeys(prev => ({ ...prev, [event.code]: false }));
  }, []);
  
  // 터치 이벤트 처리 (모바일용)
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    
    if (!gameState.isPlaying && gameState.gameResult === 'none') {
      startGame();
      return;
    }
    
    if (gameState.isPlaying && !gameState.isPaused) {
      const touch = event.touches[0];
      setTouchStart({ x: touch.clientX, y: touch.clientY });
    }
  }, [gameState.isPlaying, gameState.gameResult, gameState.isPaused, startGame]);
  
  // 터치 이동 (드래그)
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    
    if (!touchStart || !gameState.isPlaying || gameState.isPaused) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const threshold = 20; // 최소 이동 거리
    
    // 터치 방향에 따른 조작
    setTouchControls({
      left: deltaX < -threshold,
      right: deltaX > threshold,
      up: deltaY < -threshold,
      down: deltaY > threshold,
      jump: false
    });
  }, [touchStart, gameState.isPlaying, gameState.isPaused]);
  
  // 터치 종료
  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    setTouchStart(null);
    setTouchControls({
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false
    });
  }, []);
  
  // 캔버스 렌더링
  const renderGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 캔버스 클리어
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 네온 그리드 배경
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }
    
    // 파티클 렌더링
    particles.forEach(particle => {
      ctx.save();
      ctx.globalAlpha = particle.life / particle.maxLife;
      ctx.fillStyle = particle.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    
    // 게임 시작 전 안내 텍스트 (반응형 폰트 크기)
    if (!gameState.isPlaying && gameState.gameResult === 'none') {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
      ctx.textAlign = 'center';
      
      // 캔버스 크기에 따른 반응형 폰트 크기 계산
      const baseFontSize = Math.min(canvas.width / 30, 18);
      const smallFontSize = Math.min(canvas.width / 40, 14);
      
      // 메인 안내 텍스트
      ctx.font = `bold ${baseFontSize}px Arial`;
      ctx.fillText('화면을 터치하거나 SPACE를 눌러 시작하세요!', canvas.width / 2, canvas.height / 2 - 50);
      
      // 서브 안내 텍스트
      ctx.font = `${smallFontSize}px Arial`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('화살을 피해 15초간 생존하세요!', canvas.width / 2, canvas.height / 2 - 20);
      
      ctx.restore();
    }
    
    // 파워업 렌더링
    powerUps.forEach(powerUp => {
      ctx.save();
      ctx.fillStyle = powerUp.type === 'shield' ? '#00ffff' : 
                     powerUp.type === 'health' ? '#ff0080' :
                     powerUp.type === 'invincible' ? '#ffff00' : '#ff8000';
      ctx.shadowBlur = 15;
      ctx.shadowColor = ctx.fillStyle;
      ctx.beginPath();
      ctx.arc(powerUp.x, powerUp.y, powerUp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    
    // 화살 렌더링
    arrows.forEach(arrow => {
      ctx.save();
      ctx.translate(arrow.x, arrow.y);
      
      const angle = Math.atan2(arrow.velocityY, arrow.velocityX);
      ctx.rotate(angle);
      
      // 화살 색상 설정
      let color = '#ff0000';
      switch (arrow.type) {
        case 'fire': color = '#ff4400'; break;
        case 'ice': color = '#00aaff'; break;
        case 'lightning': color = '#ffff00'; break;
        case 'homing': color = '#ff00ff'; break;
        default: color = '#ff0000'; break;
      }
      
      ctx.fillStyle = color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      
      // 화살 모양 그리기
      ctx.beginPath();
      ctx.moveTo(arrow.size, 0);
      ctx.lineTo(-arrow.size / 2, -arrow.size / 3);
      ctx.lineTo(-arrow.size / 4, 0);
      ctx.lineTo(-arrow.size / 2, arrow.size / 3);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    });
    
    // 플레이어 렌더링
    if (gameState.isPlaying || gameState.isPaused) {
      ctx.save();
      ctx.fillStyle = player.invincible ? '#ffff00' : 
                     player.shield ? '#00ffff' : '#00ff00';
      ctx.shadowBlur = player.invincible ? 30 : 20;
      ctx.shadowColor = ctx.fillStyle;
      
      if (player.invincible) {
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(Date.now() / 100);
      }
      
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.size / 2, 0, Math.PI * 2);
      ctx.fill();
      
      // 실드 효과
      if (player.shield) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size / 2 + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.restore();
    }
  }, [gameState, player, arrows, powerUps, particles]);
  // 윈도우 리사이즈 및 초기 캔버스 크기 설정
  useEffect(() => {
    updateCanvasSize();
    
    const handleResize = () => {
      updateCanvasSize();
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [updateCanvasSize]);
  
  // 키보드 이벤트 등록
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
  
  // 게임 루프 시작 (참조 코드 구조)
  useEffect(() => {
    if (gameState.isPlaying && !gameState.isPaused) {
      const loop = (time: number) => {
        gameLoop(time);
        gameLoopRef.current = requestAnimationFrame(loop);
      };
      gameLoopRef.current = requestAnimationFrame(loop);
    }
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState.isPlaying, gameState.isPaused, gameLoop]);

  // 렌더링 루프
  useEffect(() => {
    const render = () => {
      renderGame();
      requestAnimationFrame(render);
    };
    render();
  }, [renderGame]);
  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-br from-black via-purple-900 to-black p-1 sm:p-2 overflow-x-auto">
      {/* 게임 제목 */}
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-2 sm:mb-4"
      >
        <h1 className="text-xl sm:text-3xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-1"
            style={{
              textShadow: '0 0 30px rgba(147, 51, 234, 0.8)'
            }}>
                    {t('games.reverseDarts.title')}
        </h1>
        <p className="text-sm sm:text-base text-cyan-300 font-semibold tracking-wide">
                    {t('games.reverseDarts.subtitle')}
        </p>
      </motion.div>

      {/* 게임 상태 UI */}
      <div className="flex flex-row justify-between items-center w-full max-w-3xl mb-2 gap-2">
        {/* 시간 */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2 border border-cyan-500/30">
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-300 font-mono text-sm">
              {(gameState.timeRemaining / 1000).toFixed(1)}s
            </span>
          </div>
        </div>
      
        {/* 체력 */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2 border border-red-500/30">
          <div className="flex items-center space-x-1">
            {Array.from({ length: 3 }, (_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 ${
                  i < player.health ? 'text-red-500 fill-red-500' : 'text-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      
        {/* 점수 */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2 border border-yellow-500/30">
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-300 font-mono text-sm">
              {gameState.score}
            </span>
          </div>
        </div>
      </div>

      {/* 게임 캔버스 */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="border-2 border-cyan-500/50 rounded-lg bg-black shadow-2xl max-w-full h-auto"
          style={{
            boxShadow: '0 0 50px rgba(0, 255, 255, 0.3)',
            filter: gameState.isPaused ? 'blur(2px)' : 'none',
            touchAction: 'none' // 스크롤 방지
          }}
        />
        
        {/* 일시정지 오버레이 */}
        {gameState.isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <div className="text-center">
              <Pause className="w-12 h-12 text-cyan-400 mx-auto mb-2" />
              <p className="text-xl text-white font-bold">                {t('games.reverseDarts.paused')}</p>
            </div>
          </div>
        )}

        {/* 게임 결과 오버레이 */}
        {gameState.gameResult !== 'none' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg"
          >
            <div className="text-center p-4">
              <div className="text-6xl mb-2">
                {gameState.gameResult === 'win' ? '🎉' : '💥'}
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${
                gameState.gameResult === 'win' ? 'text-green-400' : 'text-red-400'
              }`}>
                                {gameState.gameResult === 'win' ? t('games.reverseDarts.victory') : t('games.reverseDarts.gameOver')}
              </h2>
              <p className="text-lg text-gray-300 mb-1">
                                {t('games.reverseDarts.finalScore')}: {gameState.score}
              </p>
              <p className="text-sm text-gray-400 mb-4">
                생존 시간: {((GAME_CONFIG.GAME_DURATION - gameState.timeRemaining) / 1000).toFixed(1)}초
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* 게임 컨트롤 */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-3">
        {!gameState.isPlaying ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startGame}
            className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg"
          >
            <Play className="w-5 h-5" />
                        <span>{t('common.start')}</span>
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePause}
            className="flex items-center space-x-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg"
          >
            {gameState.isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                        <span>{gameState.isPaused ? t('common.resume') : t('common.pause')}</span>
          </motion.button>
        )}
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={resetGame}
          className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg"
        >
          <RotateCcw className="w-5 h-5" />
                    <span>{t('common.reset')}</span>
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setGameState(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
          className="flex items-center space-x-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg"
        >
          {gameState.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          <span>사운드</span>
        </motion.button>
      </div>

      {/* 조작법 안내 */}
      <div className="mt-4 bg-black/30 backdrop-blur-sm rounded-lg p-3 border border-cyan-500/20 max-w-3xl">
                <h3 className="text-cyan-300 font-bold mb-2 text-sm">{t('games.reverseDarts.howToPlay')}:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-300">
          <div>🎯 <strong>WASD/방향키</strong>: 이동</div>
          <div>⏸️ <strong>P</strong>: 일시정지</div>
          <div>🔄 <strong>R</strong>: 재시작</div>
          <div>🚀 <strong>Space/터치</strong>: 시작</div>
        </div>
      </div>
      
      {/* 모바일 조작법 안내 */}
      <div className="mt-2 bg-black/30 backdrop-blur-sm rounded-lg p-3 border border-green-500/20 max-w-3xl md:hidden">
        <h3 className="text-green-300 font-bold mb-2 text-sm">📱 모바일 조작:</h3>
        <div className="grid grid-cols-1 gap-2 text-xs text-gray-300">
          <div>👆 <strong>터치 + 드래그</strong>: 플레이어 이동</div>
          <div>🎯 <strong>터치</strong>: 게임 시작</div>
        </div>
      </div>

      {/* 통계 */}
      {stats.totalGames > 0 && (
        <div className="mt-3 bg-black/30 backdrop-blur-sm rounded-lg p-3 border border-purple-500/20 max-w-3xl">
          <h3 className="text-purple-300 font-bold mb-2 text-sm">통계:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-300">
            <div>🎮 게임 수: {stats.totalGames}</div>
            <div>🏆 승률: {stats.winRate.toFixed(1)}%</div>
            <div>⭐ 최고 점수: {stats.maxScore}</div>
            <div>⏱️ 평균 생존: {stats.averageSurvivalTime.toFixed(1)}초</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReverseDarts;
