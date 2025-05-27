declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}
declare class Logger {
    private currentLevel;
    private logDir;
    private enableFileLogging;
    constructor();
    private formatMessage;
    private writeToFile;
    private log;
    error(message: string, data?: any, error?: Error): void;
    warn(message: string, data?: any): void;
    info(message: string, data?: any): void;
    debug(message: string, data?: any): void;
    apiRequest(method: string, url: string, data?: any): void;
    apiResponse(method: string, url: string, statusCode: number, responseTime?: number): void;
    dbOperation(operation: string, table: string, data?: any): void;
    walletOperation(operation: string, walletAddress: string, data?: any): void;
    private maskWalletAddress;
    setLevel(level: keyof typeof LogLevel): void;
    getCurrentLevel(): string;
}
export declare const logger: Logger;
export { LogLevel };
