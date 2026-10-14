import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { groupRepository } from '../../src/modules/groups/group.repository';
import { expenseRepository } from '../../src/modules/expenses/expense.repository';

// Runs without a database: repositories are replaced with in-memory fakes (vi.mock is hoisted).
vi.mock('../../src/modules/groups/group.repository', () => ({ groupRepository: { findById: vi.fn() } }));
vi.mock('../../src/modules/expenses/expense.repository', () => ({ expenseRepository: { create: vi.fn() } }));

const user = (id: number, name: string) => ({ userId: id, user: { id, name } });
const group = (status: 'OPEN' | 'CLOSED' = 'OPEN') => ({
  id: 1,
  name: 'Viagem',
  currency: 'BRL',
  status,
  createdAt: new Date(),
  closedAt: null,
  members: [user(1, 'Ana'), user(2, 'Bruno'), user(3, 'Caio')],
});

beforeEach(() => {
  vi.mocked(groupRepository.findById).mockResolvedValue(group() as never);
  vi.mocked(expenseRepository.create).mockImplementation(async (data) => ({
    id: 10,
    ...data,
    createdAt: new Date(),
    payer: { id: data.payerId, name: 'Ana' },
    splits: data.splits.map((s) => ({ ...s, expenseId: 10, user: { id: s.userId, name: `#${s.userId}` } })),
  }) as never);
});

describe('POST /groups/:id/expenses', () => {
  const body = {
    description: 'Jantar',
    amount: '100.00',
    payerId: 1,
    splitType: 'EQUAL',
    participants: [{ userId: 1 }, { userId: 2 }, { userId: 3 }],
  };

  it('creates an equal split whose shares add up to the total', async () => {
    const res = await request(app).post('/groups/1/expenses').send(body);
    expect(res.status).toBe(201);
    expect(res.body.splits.map((s: { share: string }) => s.share)).toEqual(['33.34', '33.33', '33.33']);
  });

  it('rejects float-like precision beyond the currency', async () => {
    const res = await request(app).post('/groups/1/expenses').send({ ...body, amount: '10.005' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/decimal place/);
  });

  it('rejects participants that are not members', async () => {
    const res = await request(app)
      .post('/groups/1/expenses')
      .send({ ...body, participants: [{ userId: 1 }, { userId: 99 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not members/);
  });

  it('rejects percentages that do not add up to 100', async () => {
    const res = await request(app)
      .post('/groups/1/expenses')
      .send({
        ...body,
        splitType: 'PERCENT',
        participants: [
          { userId: 1, value: '50' },
          { userId: 2, value: '30' },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/add up to 100/);
  });

  it('rejects dates in the future', async () => {
    const res = await request(app).post('/groups/1/expenses').send({ ...body, date: '2999-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/future/);
  });

  it('rejects malformed bodies with a readable message', async () => {
    const res = await request(app).post('/groups/1/expenses').send({ ...body, payerId: 'ana' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^payerId:/);
  });

  it('answers 409 on a closed group', async () => {
    vi.mocked(groupRepository.findById).mockResolvedValue(group('CLOSED') as never);
    const res = await request(app).post('/groups/1/expenses').send(body);
    expect(res.status).toBe(409);
  });

  it('answers 400 on a non-numeric group id instead of a 500', async () => {
    const res = await request(app).post('/groups/abc/expenses').send(body);
    expect(res.status).toBe(400);
  });
});
