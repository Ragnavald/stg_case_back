import { AppError } from '../../middlewares/errorHandler';
import { userRepository } from './user.repository';
import { CreateUserDTO } from './user.types';

export const userService = {
  list() {
    return userRepository.findAll();
  },

  async getById(id: number) {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError('User not found', 404);
    return user;
  },

  create(data: CreateUserDTO) {
    if (!data.name?.trim()) throw new AppError('Name is required');
    return userRepository.create({ name: data.name.trim() });
  },
};
