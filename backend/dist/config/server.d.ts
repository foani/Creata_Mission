import cors from 'cors';
export interface ServerConfig {
    port: number;
    host: string;
    cors: {
        origin: string | string[] | boolean;
        credentials: boolean;
        methods: string[];
        allowedHeaders: string[];
    };
    rateLimit: {
        windowMs: number;
        max: number;
        message: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
}
export declare const createCorsMiddleware: (config: ServerConfig) => (req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void;
export declare const createRateLimitMiddleware: (config: ServerConfig) => import("express-rate-limit").RateLimitRequestHandler;
export declare const createRequestLoggerMiddleware: () => (req: any, res: any, next: any) => void;
export declare const createErrorHandlerMiddleware: () => (error: any, req: any, res: any, next: any) => void;
export declare const createNotFoundHandlerMiddleware: () => (req: any, res: any) => void;
export declare const serverConfig: ServerConfig;
export declare function logServerConfig(): void;
