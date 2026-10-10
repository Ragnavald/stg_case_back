import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/middlewares/errorHandler';
import { userRepository } from '../../src/modules/users/user.repository';
import { userService } from '../../src/modules/users/user.service';

vi.mock('../../src/modules/users/user.repository', () => ({
  userRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));

const repo = vi.mocked(userRepository);

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists users from the repository', async () => {
    repo.findAll.mockResolvedValue([{ id: 1, name: 'Ana' }]);

    await expect(userService.list()).resolves.toEqual([{ id: 1, name: 'Ana' }]);
  });

  it('returns a user by id', async () => {
    repo.findById.mockResolvedValue({ id: 1, name: 'Ana' });

    await expect(userService.getById(1)).resolves.toEqual({ id: 1, name: 'Ana' });
    expect(repo.findById).toHaveBeenCalledWith(1);
  });

  it('throws 404 when the user does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    const error = await userService.getById(99).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
  });

  it('trims the name before creating', async () => {
    repo.create.mockResolvedValue({ id: 1, name: 'Ana' });

    await userService.create({ name: '  Ana  ' });

    expect(repo.create).toHaveBeenCalledWith({ name: 'Ana' });
  });

  it('rejects an empty name', () => {
    expect(() => userService.create({ name: '   ' })).toThrow('Name is required');
    expect(repo.create).not.toHaveBeenCalled();
  });
});
