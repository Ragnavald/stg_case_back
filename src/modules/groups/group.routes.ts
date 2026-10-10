import { Router } from 'express';
import { groupController } from './group.controller';
import { expenseRoutes } from '../expenses/expense.routes';
import { settlementRoutes } from '../settlements/settlement.routes';

export const groupRoutes = Router();

groupRoutes.get('/', groupController.list);
groupRoutes.post('/', groupController.create);
groupRoutes.get('/:groupId', groupController.getById);

groupRoutes.post('/:groupId/members', groupController.addMember);
groupRoutes.delete('/:groupId/members/:userId', groupController.removeMember);
groupRoutes.get('/:groupId/members/:userId/statement', groupController.statement);

groupRoutes.get('/:groupId/balances', groupController.balances);
groupRoutes.post('/:groupId/close', groupController.close);
groupRoutes.post('/:groupId/reopen', groupController.reopen);

groupRoutes.use('/:groupId/expenses', expenseRoutes);
groupRoutes.use('/:groupId/settlements', settlementRoutes);
