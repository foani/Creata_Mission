import fs from 'fs';
import path from 'path';
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (LogLevel = {}));
class Logger {
    currentLevel;
    logDir;
    enableFileLogging;
    constructor() {
        const envLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
        const parsedLevel = LogLevel[envLevel];
        this.currentLevel = typeof parsedLevel === 'number' ? parsedLevel : LogLevel.INFO;
        this.logDir = path.join(process.cwd(), 'logs');
        this.enableFileLogging = process.env.NODE_ENV === 'production';
        if (this.enableFileLogging && !fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }
    formatMessage(level, message, data) {
        const timestamp = new Date().toISOString();
        const baseMessage = `[${timestamp}] [${level}] ${message}`;
        if (data) {
            return `${baseMessage} ${JSON.stringify(data, null, 2)}`;
        }
        return baseMessage;
    }
    writeToFile(logData) {
        if (!this.enableFileLogging)
            return;
        let logLine = `${this.formatMessage(logData.level, logData.message, logData.data)}\n`;
        if (logData.error && logData.error.stack) {
            logLine += `Stack Trace: ${logData.error.stack}\n`;
        }
        try {
            const today = new Date().toISOString().split('T')[0];
            const logFile = path.join(this.logDir, `creata-mission-${today}.log`);
            fs.appendFileSync(logFile, logLine);
        }
        catch (error) {
            console.error('로그 파일 쓰기 실패:', error);
        }
    }
    log(level, levelName, message, data, error) {
        if (level > this.currentLevel)
            return;
        const logData = {
            timestamp: new Date().toISOString(),
            level: levelName,
            message,
            data,
            error
        };
        const consoleMessage = this.formatMessage(levelName, message, data);
        switch (level) {
            case LogLevel.ERROR:
                console.error(consoleMessage);
                if (error)
                    console.error(error.stack);
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
        this.writeToFile(logData);
    }
    error(message, data, error) {
        this.log(LogLevel.ERROR, 'ERROR', message, data, error);
    }
    warn(message, data) {
        this.log(LogLevel.WARN, 'WARN', message, data);
    }
    info(message, data) {
        this.log(LogLevel.INFO, 'INFO', message, data);
    }
    debug(message, data) {
        this.log(LogLevel.DEBUG, 'DEBUG', message, data);
    }
    apiRequest(method, url, data) {
        this.info(`API 요청: ${method} ${url}`, data);
    }
    apiResponse(method, url, statusCode, responseTime) {
        const message = `API 응답: ${method} ${url} - ${statusCode}`;
        const data = responseTime ? { responseTime: `${responseTime}ms` } : undefined;
        this.info(message, data);
    }
    dbOperation(operation, table, data) {
        this.debug(`DB 작업: ${operation} on ${table}`, data);
    }
    walletOperation(operation, walletAddress, data) {
        const maskedAddress = this.maskWalletAddress(walletAddress);
        this.info(`지갑 작업: ${operation} for ${maskedAddress}`, data);
    }
    maskWalletAddress(address) {
        if (!address || address.length < 10)
            return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    setLevel(level) {
        this.currentLevel = LogLevel[level];
        this.info(`로그 레벨 변경: ${level}`);
    }
    getCurrentLevel() {
        return LogLevel[this.currentLevel];
    }
}
export const logger = new Logger();
export { LogLevel };
