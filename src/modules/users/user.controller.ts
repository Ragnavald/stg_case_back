import { Request, Response } from 'express';
import { userService } from './user.service';

export const userController = {
  async list(req: Request, res: Response) {
    const users = await userService.list();
    res.json(users);
  },

  async getById(req: Request<{ id: string }>, res: Response) {
    const user = await userService.getById(Number(req.params.id));
    res.json(user);
  },

  async create(req: Request, res: Response) {
    const user = await userService.create(req.body);
    res.status(201).json(user);
  },
};
