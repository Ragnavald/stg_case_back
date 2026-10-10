import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { groupRepository } from '../../src/modules/groups/group.repository';
import { userRepository } from '../../src/modules/users/user.repository';

// Runs without a database: repositories are replaced with in-memory fakes (vi.mock is hoisted).
vi.mock('../../src/modules/groups/group.repository', () => ({
  groupRepository: {
    findAll: vi.fn(),
    totalSpentByGroup: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    findLedger: vi.fn(),
    close: vi.fn(),
  },
}));
vi.mock('../../src/modules/users/user.repository', () => ({ userRepository: { findByIds: vi.fn() } }));

const repo = vi.mocked(groupRepository);
const users = vi.mocked(userRepository);

const member = (id: number, name: string) => ({ groupId: 1, userId: id, joinedAt: new Date(), user: { id, name } });
const group = (status: 'OPEN' | 'CLOSED' = 'OPEN') => ({
  id: 1,
  name: 'Viagem',
  currency: 'BRL',
  status,
  createdAt: new Date(),
  closedAt: null,
  members: [member(1, 'Ana'), member(2, 'Bruno'), member(3, 'Caio')],
});

beforeEach(() => {
  vi.clearAllMocks();
  repo.findById.mockResolvedValue(group() as never);
  repo.findLedger.mockResolvedValue({ expenses: [], settlements: [] });
  users.findByIds.mockResolvedValue([]);
});

describe('groups and members', () => {
  it('GET /currencies lists supported currencies with their exponent', async () => {
    const res = await request(app).get('/currencies');
    expect(res.status).toBe(200);
    expect(res.body).toContainEqual({ code: 'JPY', exponent: 0 });
  });

  it('POST /groups requires at least one member', async () => {
    const res = await request(app).post('/groups').send({ name: 'Viagem', members: [] });
    expect(res.status).toBe(400);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('POST /groups rejects unsupported currencies', async () => {
    const res = await request(app).post('/groups').send({ name: 'Viagem', currency: 'XXX', members: [{ name: 'Ana' }] });
    expect(res.status).toBe(400);
  });

  it('POST /groups rejects unknown user ids', async () => {
    const res = await request(app).post('/groups').send({ name: 'Viagem', members: [{ userId: 99 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown user/);
  });

  it('GET /groups/:id answers 404 for an unknown group and 400 for a bad id', async () => {
    repo.findById.mockResolvedValue(null);
    expect((await request(app).get('/groups/7')).status).toBe(404);
    expect((await request(app).get('/groups/abc')).status).toBe(400);
  });

  it('DELETE /groups/:id/members/:userId refuses members with an open balance', async () => {
    const d = new Date('2026-10-01T00:00:00Z');
    repo.findLedger.mockResolvedValue({
      expenses: [
        { id: 1, description: 'x', date: d, createdAt: d, payerId: 1, amountMinor: 1000n, splits: [{ userId: 2, shareMinor: 1000n }] },
      ],
      settlements: [],
    });
    const res = await request(app).delete('/groups/1/members/2');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/owes BRL 10.00/);
  });
});
