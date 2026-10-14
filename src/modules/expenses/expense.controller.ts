import { Request, Response } from 'express';
import { parseId } from '../../lib/http';
import { expenseService } from './expense.service';
import { createExpenseSchema } from './expense.schemas';

type GroupParams = { groupId: string };
type ExpenseParams = GroupParams & { expenseId: string };

export const expenseController = {
  async list(req: Request<GroupParams>, res: Response) {
    res.json(await expenseService.list(parseId(req.params.groupId, 'group id')));
  },

  async create(req: Request<GroupParams>, res: Response) {
    const expense = await expenseService.create(
      parseId(req.params.groupId, 'group id'),
      createExpenseSchema.parse(req.body),
    );
    res.status(201).json(expense);
  },

  async remove(req: Request<ExpenseParams>, res: Response) {
    await expenseService.remove(parseId(req.params.groupId, 'group id'), parseId(req.params.expenseId, 'expense id'));
    res.status(204).end();
  },
};
