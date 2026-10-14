import { Router } from 'express';
import { settlementController } from './settlement.controller';

/** Mounted under /groups/:groupId/settlements */
export const settlementRoutes = Router({ mergeParams: true });

settlementRoutes.get('/', settlementController.list);
settlementRoutes.post('/', settlementController.create);
settlementRoutes.delete('/:settlementId', settlementController.remove);
