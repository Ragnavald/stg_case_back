import { Router } from 'express';
import { expenseController } from './expense.controller';

/** Mounted under /groups/:groupId/expenses */
export const expenseRoutes = Router({ mergeParams: true });

expenseRoutes.get('/', expenseController.list);
expenseRoutes.post('/', expenseController.create);
expenseRoutes.delete('/:expenseId', expenseController.remove);
