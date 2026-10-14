import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { groupRepository } from '../../src/modules/groups/group.repository';
import { settlementRepository } from '../../src/modules/settlements/settlement.repository';

// Runs without a database: repositories are replaced with in-memory fakes (vi.mock is hoisted).
vi.mock('../../src/modules/groups/group.repository', () => ({ groupRepository: { findById: vi.fn() } }));
vi.mock('../../src/modules/settlements/settlement.repository', () => ({ settlementRepository: { create: vi.fn() } }));

const user = (id: number, name: string) => ({ userId: id, user: { id, name } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(groupRepository.findById).mockResolvedValue({
    id: 1,
    name: 'Viagem',
    currency: 'BRL',
    status: 'OPEN',
    createdAt: new Date(),
    closedAt: null,
    members: [user(1, 'Ana'), user(2, 'Bruno')],
  } as never);
  vi.mocked(settlementRepository.create).mockImplementation(async (data) => ({
    id: 5,
    ...data,
    createdAt: new Date(),
    from: { id: data.fromUserId, name: 'Ana' },
    to: { id: data.toUserId, name: 'Bruno' },
  }) as never);
});

describe('POST /groups/:id/settlements', () => {
  it('records a payment between two members in minor units', async () => {
    const res = await request(app).post('/groups/1/settlements').send({ fromUserId: 1, toUserId: 2, amount: '50' });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe('50.00');
    expect(settlementRepository.create).toHaveBeenCalledWith({ groupId: 1, fromUserId: 1, toUserId: 2, amountMinor: 5000n });
  });

  it('rejects paying yourself', async () => {
    const res = await request(app).post('/groups/1/settlements').send({ fromUserId: 1, toUserId: 1, amount: '50' });
    expect(res.status).toBe(400);
  });

  it('rejects people outside the group', async () => {
    const res = await request(app).post('/groups/1/settlements').send({ fromUserId: 1, toUserId: 9, amount: '50' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not members/);
  });

  it('rejects a zero amount', async () => {
    const res = await request(app).post('/groups/1/settlements').send({ fromUserId: 1, toUserId: 2, amount: '0' });
    expect(res.status).toBe(400);
  });
});
