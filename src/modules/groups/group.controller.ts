import { Request, Response } from 'express';
import { parseId } from '../../lib/http';
import { groupService } from './group.service';
import { createGroupSchema, memberRefSchema } from './group.schemas';

type GroupParams = { groupId: string };
type MemberParams = GroupParams & { userId: string };

export const groupController = {
  async list(req: Request, res: Response) {
    res.json(await groupService.list());
  },

  async getById(req: Request<GroupParams>, res: Response) {
    res.json(await groupService.getById(parseId(req.params.groupId, 'group id')));
  },

  async create(req: Request, res: Response) {
    const group = await groupService.create(createGroupSchema.parse(req.body));
    res.status(201).json(group);
  },

  async addMember(req: Request<GroupParams>, res: Response) {
    const group = await groupService.addMember(parseId(req.params.groupId, 'group id'), memberRefSchema.parse(req.body));
    res.status(201).json(group);
  },

  async removeMember(req: Request<MemberParams>, res: Response) {
    res.json(
      await groupService.removeMember(parseId(req.params.groupId, 'group id'), parseId(req.params.userId, 'user id')),
    );
  },

  async balances(req: Request<GroupParams>, res: Response) {
    res.json(await groupService.balances(parseId(req.params.groupId, 'group id')));
  },

  async statement(req: Request<MemberParams>, res: Response) {
    res.json(
      await groupService.statement(parseId(req.params.groupId, 'group id'), parseId(req.params.userId, 'user id')),
    );
  },
};
