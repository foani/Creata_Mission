import { Request, Response } from 'express';
interface AuthRequest extends Request {
    body: {
        walletAddress: string;
        message: string;
        signature: string;
        telegramId?: string;
    };
}
export declare class AuthController {
    private authService;
    constructor();
    verifyWallet(req: AuthRequest, res: Response): Promise<void>;
    catch(error: any): void;
}
export declare const authController: AuthController;
export {};
