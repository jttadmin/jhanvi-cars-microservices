import request from 'supertest';

jest.mock('../src/repositories/user.repository');
jest.mock('../src/services/user-profile.client', () => ({
  initializeUserProfile: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/services/token.service', () => ({
  tokenProvider: { issue: jest.fn().mockResolvedValue('fake.jwt.token') },
}));

import { userRepository } from '../src/repositories/user.repository';
import { createApp } from '../src/app';

const mockedRepo = userRepository as jest.Mocked<typeof userRepository>;
const app = createApp();

describe('POST /auth/register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 201 and a token for valid input', async () => {
    mockedRepo.findByEmail.mockResolvedValue(undefined);
    mockedRepo.findByMobileNumber.mockResolvedValue(undefined);
    mockedRepo.create.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      mobile_number: '9876543210',
      password_hash: 'hashed',
      role: 'CUSTOMER',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const res = await request(app).post('/auth/register').send({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      mobileNumber: '9876543210',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBe('fake.jwt.token');
  });

  it('returns 422 for an invalid email', async () => {
    const res = await request(app).post('/auth/register').send({
      fullName: 'Jane Doe',
      email: 'not-an-email',
      mobileNumber: '9876543210',
      password: 'password123',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});


describe('GET /auth/internal/users/:id', () => {
  const originalToken = process.env.INTERNAL_SERVICE_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
  });

  afterAll(() => {
    if (originalToken === undefined) {
      delete process.env.INTERNAL_SERVICE_TOKEN;
    } else {
      process.env.INTERNAL_SERVICE_TOKEN = originalToken;
    }
  });

  it('rejects requests without the internal service token', async () => {
    const res = await request(app).get('/auth/internal/users/00000000-0000-4000-8000-000000000001');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(mockedRepo.findById).not.toHaveBeenCalled();
  });

  it('returns public user details with a valid internal token', async () => {
    mockedRepo.findById.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      mobile_number: '9876543210',
      password_hash: 'must-not-be-returned',
      role: 'CUSTOMER',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    });

    const res = await request(app)
      .get('/auth/internal/users/00000000-0000-4000-8000-000000000001')
      .set('x-internal-service-token', 'test-internal-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('jane@example.com');
    expect(res.body.data.user.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  it('rejects malformed user IDs before querying the repository', async () => {
    const res = await request(app)
      .get('/auth/internal/users/not-a-uuid')
      .set('x-internal-service-token', 'test-internal-token');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_USER_ID');
    expect(mockedRepo.findById).not.toHaveBeenCalled();
  });

  it('returns 404 when the requested user does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(undefined);

    const res = await request(app)
      .get('/auth/internal/users/00000000-0000-4000-8000-000000000002')
      .set('x-internal-service-token', 'test-internal-token');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(mockedRepo.findById).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000002');
  });
});
