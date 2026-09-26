import request from 'supertest';

jest.mock('../src/repositories/user.repository');
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
      id: 'user-1',
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
