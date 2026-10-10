import { Router } from 'express';
import { groupController } from './group.controller';
import { expenseRoutes } from '../expenses/expense.routes';

export const groupRoutes = Router();

groupRoutes.get('/', groupController.list);
groupRoutes.post('/', groupController.create);
groupRoutes.get('/:groupId', groupController.getById);

groupRoutes.post('/:groupId/members', groupController.addMember);
groupRoutes.delete('/:groupId/members/:userId', groupController.removeMember);

groupRoutes.use('/:groupId/expenses', expenseRoutes);
