import { prisma } from '../../config/db';
import { User, CreateUserDTO } from './user.types';

export const userRepository = {
  findAll(): Promise<User[]> {
    return prisma.user.findMany({ orderBy: { id: 'asc' } });
  },

  findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  findByIds(ids: number[]): Promise<User[]> {
    return prisma.user.findMany({ where: { id: { in: ids } } });
  },

  create(data: CreateUserDTO): Promise<User> {
    return prisma.user.create({ data: { name: data.name } });
  },
};
