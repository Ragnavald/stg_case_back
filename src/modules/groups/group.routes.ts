import { Router } from 'express';
import { groupController } from './group.controller';

export const groupRoutes = Router();

groupRoutes.get('/', groupController.list);
groupRoutes.post('/', groupController.create);
groupRoutes.get('/:groupId', groupController.getById);

groupRoutes.post('/:groupId/members', groupController.addMember);
groupRoutes.delete('/:groupId/members/:userId', groupController.removeMember);
