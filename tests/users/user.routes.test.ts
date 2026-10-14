import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app';
import { userRepository } from '../../src/modules/users/user.repository';

vi.mock('../../src/modules/users/user.repository', () => ({
  userRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));

const repo = vi.mocked(userRepository);

describe('/users routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /users returns the user list', async () => {
    repo.findAll.mockResolvedValue([{ id: 1, name: 'Ana' }]);

    const res = await request(app).get('/users');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, name: 'Ana' }]);
  });

  it('GET /users/:id returns 404 for an unknown user', async () => {
    repo.findById.mockResolvedValue(null);

    const res = await request(app).get('/users/99');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'User not found' });
  });

  it('POST /users creates a user', async () => {
    repo.create.mockResolvedValue({ id: 1, name: 'Ana' });

    const res = await request(app).post('/users').send({ name: 'Ana' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 1, name: 'Ana' });
  });

  it('POST /users returns 400 when name is missing', async () => {
    const res = await request(app).post('/users').send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Name is required' });
  });
});
