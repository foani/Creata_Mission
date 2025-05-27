/**
 * 로깅 유틸리티
 * 환경별 로그 레벨 설정 및 구조화된 로깅
 */

import fs from 'fs';
import path from 'path';

/**
 * 로그 레벨 열거형
 */
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

/**
 * 로그 데이터 인터페이스
 */
interface LogData {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
  error?: Error;
}

/**
 * 로거 클래스
 */
class Logger {
  private currentLevel: LogLevel;
  private logDir: string;
  private enableFileLogging: boolean;

  constructor() {
    // 환경변수에서 로그 레벨 설정 (기본: INFO)
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    const parsedLevel = LogLevel[envLevel as keyof typeof LogLevel];
    this.currentLevel = typeof parsedLevel === 'number' ? parsedLevel : LogLevel.INFO;

    // 로그 디렉토리 설정
    this.logDir = path.join(process.cwd(), 'logs');
    this.enableFileLogging = process.env.NODE_ENV === 'production';

    // 로그 디렉토리 생성
    if (this.enableFileLogging && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 로그 메시지 포맷팅
   */
  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level}] ${message}`;

    if (data) {
      return `${baseMessage} ${JSON.stringify(data, null, 2)}`;
    }
    return baseMessage;
  }

  /**
   * 파일에 로그 기록
   */
  private writeToFile(logData: LogData): void {
    if (!this.enableFileLogging) return;

    let logLine = `${this.formatMessage(logData.level, logData.message, logData.data)}\n`;

    if (logData.error && logData.error.stack) {
      logLine += `Stack Trace: ${logData.error.stack}\n`;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `creata-mission-${today}.log`);

      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('로그 파일 쓰기 실패:', error);
    }
  }

  /**
   * 로그 기록 공통 메서드
   */
  private log(level: LogLevel, levelName: string, message: string, data?: any, error?: Error): void {
    if (level > this.currentLevel) return;

    const logData: LogData = {
      timestamp: new Date().toISOString(),
      level: levelName,
      message,
      data,
      error
    };

    // 콘솔 출력
    const consoleMessage = this.formatMessage(levelName, message, data);

    switch (level) {
      case LogLevel.ERROR:
        console.error(consoleMessage);
        if (error) console.error(error.stack);
        break;
      case LogLevel.WARN:
        console.warn(consoleMessage);
        break;
      case LogLevel.INFO:
        console.info(consoleMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(consoleMessage);
        break;
    }

    // 파일 로깅
    this.writeToFile(logData);
  }

  /**
   * 오류 로그
   */
  error(message: string, data?: any, error?: Error): void {
    this.log(LogLevel.ERROR, 'ERROR', message, data, error);
  }

  /**
   * 경고 로그
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, 'WARN', message, data);
  }

  /**
   * 정보 로그
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, 'INFO', message, data);
  }

  /**
   * 디버그 로그
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, data);
  }

  /**
   * API 요청 로그 (미들웨어에서 사용)
   */
  apiRequest(method: string, url: string, data?: any): void {
    this.info(`API 요청: ${method} ${url}`, data);
  }

  /**
   * API 응답 로그
   */
  apiResponse(method: string, url: string, statusCode: number, responseTime?: number): void {
    const message = `API 응답: ${method} ${url} - ${statusCode}`;
    const data = responseTime ? { responseTime: `${responseTime}ms` } : undefined;
    this.info(message, data);
  }

  /**
   * 데이터베이스 작업 로그
   */
  dbOperation(operation: string, table: string, data?: any): void {
    this.debug(`DB 작업: ${operation} on ${table}`, data);
  }

  /**
   * 지갑 관련 로그 (보안 사유로 주소 마스킹)
   */
  walletOperation(operation: string, walletAddress: string, data?: any): void {
    const maskedAddress = this.maskWalletAddress(walletAddress);
    this.info(`지갑 작업: ${operation} for ${maskedAddress}`, data);
  }

  /**
   * 지갑 주소 마스킹 (보안)
   */
  private maskWalletAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * 로그 레벨 설정
   */
  setLevel(level: keyof typeof LogLevel): void {
    this.currentLevel = LogLevel[level];
    this.info(`로그 레벨 변경: ${level}`);
  }

  /**
   * 현재 로그 레벨 반환
   */
  getCurrentLevel(): string {
    return LogLevel[this.currentLevel];
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const logger = new Logger();

// 로그 레벨 열거형도 내보내기 (필요시 사용)
export { LogLevel };
