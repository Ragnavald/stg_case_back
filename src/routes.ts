import { Router, Request, Response } from 'express';

export const routes = Router();

routes.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});
