import { Request, Response } from 'express';
import { parseId } from '../../lib/http';
import { settlementService } from './settlement.service';
import { createSettlementSchema } from './settlement.schemas';

type GroupParams = { groupId: string };
type SettlementParams = GroupParams & { settlementId: string };

export const settlementController = {
  async list(req: Request<GroupParams>, res: Response) {
    res.json(await settlementService.list(parseId(req.params.groupId, 'group id')));
  },

  async create(req: Request<GroupParams>, res: Response) {
    const settlement = await settlementService.create(
      parseId(req.params.groupId, 'group id'),
      createSettlementSchema.parse(req.body),
    );
    res.status(201).json(settlement);
  },

  async remove(req: Request<SettlementParams>, res: Response) {
    await settlementService.remove(
      parseId(req.params.groupId, 'group id'),
      parseId(req.params.settlementId, 'settlement id'),
    );
    res.status(204).end();
  },
};
