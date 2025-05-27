import { Request, Response } from 'express';
interface GameStatsRequest extends Request {
    params: {
        walletAddress: string;
    };
}
export declare class GameController {
    private gameService;
    constructor();
    catch(error: any): void;
    getGameStats(req: GameStatsRequest, res: Response): Promise<void>;
    disconnect(): Promise<void>;
}
export declare const gameController: GameController;
export {};
