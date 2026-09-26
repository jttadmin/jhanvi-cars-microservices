import bcrypt from 'bcrypt';

jest.mock('../src/repositories/user.repository');
jest.mock('../src/services/token.service', () => ({
  tokenProvider: { issue: jest.fn().mockResolvedValue('fake.jwt.token') },
}));

import { userRepository } from '../src/repositories/user.repository';
import { authService } from '../src/services/auth.service';
import { ConflictError, UnauthorizedError } from '../src/errors/AppError';

const mockedRepo = userRepository as jest.Mocked<typeof userRepository>;

describe('authService.register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a new user and returns a token', async () => {
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

    const result = await authService.register({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      mobileNumber: '9876543210',
      password: 'password123',
      role: 'CUSTOMER',
    });

    expect(result.token).toBe('fake.jwt.token');
    expect(result.user.email).toBe('jane@example.com');
    expect(mockedRepo.create).toHaveBeenCalledTimes(1);
  });

  it('throws ConflictError when the email is already registered', async () => {
    mockedRepo.findByEmail.mockResolvedValue({
      id: 'existing',
      full_name: 'Someone',
      email: 'jane@example.com',
      mobile_number: '9876543211',
      password_hash: 'hashed',
      role: 'CUSTOMER',
      created_at: new Date(),
      updated_at: new Date(),
    });

    await expect(
      authService.register({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        mobileNumber: '9876543210',
        password: 'password123',
        role: 'CUSTOMER',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('authService.login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an incorrect password with UnauthorizedError', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    mockedRepo.findByEmail.mockResolvedValue({
      id: 'user-1',
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      mobile_number: '9876543210',
      password_hash: passwordHash,
      role: 'CUSTOMER',
      created_at: new Date(),
      updated_at: new Date(),
    });

    await expect(
      authService.login({ email: 'jane@example.com', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
