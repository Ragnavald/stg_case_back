import { Router, Request, Response } from 'express';
import { userRoutes } from './modules/users/user.routes';
import { groupRoutes } from './modules/groups/group.routes';
import { CURRENCY_EXPONENTS } from './domain/money';

export const routes = Router();

routes.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

routes.get('/currencies', (req: Request, res: Response) => {
  res.json(Object.entries(CURRENCY_EXPONENTS).map(([code, exponent]) => ({ code, exponent })));
});

routes.use('/users', userRoutes);
routes.use('/groups', groupRoutes);
