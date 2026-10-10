import { Router, Request, Response } from 'express';
import { userRoutes } from './modules/users/user.routes';

export const routes = Router();

routes.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

routes.use('/users', userRoutes);
