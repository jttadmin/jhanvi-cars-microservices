import request from 'supertest';
import jwt from 'jsonwebtoken';

import { createApp } from '../src/app';
import { UserProfileService } from '../src/services/user-profile.service';

const JWT_SECRET = 'test-user-service-secret';

const USER_ID =
  '24d33314-b2ab-4b6c-81c6-26196348da51';

function createToken(userId: string): string {
  return jwt.sign(
    {
      sub: userId,
    },
    JWT_SECRET,
    {
      expiresIn: '1h',
    },
  );
}

function createServiceMock(): UserProfileService {
  return {
    getMyProfile: jest.fn(),
    updateMyProfile: jest.fn(),
  } as unknown as UserProfileService;
}

function createTestApp(
  service: UserProfileService,
) {
  return createApp({
    userProfileService: service,
    jwtSecret: JWT_SECRET,
  });
}

describe('User routes', () => {
  describe('GET /users/me', () => {
    it('rejects the request without authentication', async () => {
      const service = createServiceMock();
      const app = createTestApp(service);

      const response = await request(app)
        .get('/users/me')
        .expect(401);

      expect(response.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message:
            'Authorization header is required',
        },
      });

      expect(
        service.getMyProfile,
      ).not.toHaveBeenCalled();
    });

    it('rejects an invalid JWT', async () => {
      const service = createServiceMock();
      const app = createTestApp(service);

      const response = await request(app)
        .get('/users/me')
        .set(
          'Authorization',
          'Bearer invalid-token',
        )
        .expect(401);

      expect(response.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message:
            'Invalid or expired access token',
        },
      });

      expect(
        service.getMyProfile,
      ).not.toHaveBeenCalled();
    });

    it('rejects a malformed authorization header', async () => {
      const service = createServiceMock();
      const app = createTestApp(service);

      const response = await request(app)
        .get('/users/me')
        .set(
          'Authorization',
          'Basic something',
        )
        .expect(401);

      expect(response.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message:
            'Bearer token is required',
        },
      });

      expect(
        service.getMyProfile,
      ).not.toHaveBeenCalled();
    });

    it('returns the authenticated user profile', async () => {
      const service = createServiceMock();

      const createdAt = new Date(
        '2026-09-25T10:00:00.000Z',
      );

      const updatedAt = new Date(
        '2026-09-25T11:00:00.000Z',
      );

      (
        service.getMyProfile as jest.Mock
      ).mockResolvedValue({
        userId: USER_ID,
        displayName: 'Test Customer',
        bio: 'Customer profile',
        avatarUrl:
          'https://example.com/avatar.jpg',
        createdAt,
        updatedAt,
      });

      const app = createTestApp(service);
      const token = createToken(USER_ID);

      const response = await request(app)
        .get('/users/me')
        .set(
          'Authorization',
          `Bearer ${token}`,
        )
        .expect(200);

      expect(response.body).toEqual({
        user: {
          id: USER_ID,
          displayName: 'Test Customer',
          bio: 'Customer profile',
          avatarUrl:
            'https://example.com/avatar.jpg',
          createdAt:
            '2026-09-25T10:00:00.000Z',
          updatedAt:
            '2026-09-25T11:00:00.000Z',
        },
      });

      expect(
        service.getMyProfile,
      ).toHaveBeenCalledTimes(1);

      expect(
        service.getMyProfile,
      ).toHaveBeenCalledWith(USER_ID);
    });

    it('returns 404 when the profile does not exist', async () => {
      const service = createServiceMock();

      (
        service.getMyProfile as jest.Mock
      ).mockResolvedValue(null);

      const app = createTestApp(service);
      const token = createToken(USER_ID);

      const response = await request(app)
        .get('/users/me')
        .set(
          'Authorization',
          `Bearer ${token}`,
        )
        .expect(404);

      expect(response.body).toEqual({
        error: {
          code: 'PROFILE_NOT_FOUND',
          message:
            'User profile not found',
        },
      });

      expect(
        service.getMyProfile,
      ).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe('PATCH /users/me', () => {
    it('rejects the request without authentication', async () => {
      const service = createServiceMock();
      const app = createTestApp(service);

      const response = await request(app)
        .patch('/users/me')
        .send({
          displayName: 'Updated Customer',
        })
        .expect(401);

      expect(response.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message:
            'Authorization header is required',
        },
      });

      expect(
        service.updateMyProfile,
      ).not.toHaveBeenCalled();
    });

    it('rejects an invalid JWT', async () => {
      const service = createServiceMock();
      const app = createTestApp(service);

      const response = await request(app)
        .patch('/users/me')
        .set(
          'Authorization',
          'Bearer invalid-token',
        )
        .send({
          displayName: 'Updated Customer',
        })
        .expect(401);

      expect(response.body.error.code).toBe(
        'UNAUTHORIZED',
      );

      expect(
        service.updateMyProfile,
      ).not.toHaveBeenCalled();
    });

    it('updates the authenticated user profile', async () => {
      const service = createServiceMock();

      (
        service.updateMyProfile as jest.Mock
      ).mockResolvedValue({
        userId: USER_ID,
        displayName: 'Updated Customer',
        bio: 'Updated bio',
        avatarUrl: null,
        createdAt: new Date(
          '2026-09-25T10:00:00.000Z',
        ),
        updatedAt: new Date(
          '2026-09-25T12:00:00.000Z',
        ),
      });

      const app = createTestApp(service);
      const token = createToken(USER_ID);

      const response = await request(app)
        .patch('/users/me')
        .set(
          'Authorization',
          `Bearer ${token}`,
        )
        .send({
          displayName: 'Updated Customer',
          bio: 'Updated bio',
          avatarUrl: null,
        })
        .expect(200);

      expect(response.body).toEqual({
        user: {
          id: USER_ID,
          displayName: 'Updated Customer',
          bio: 'Updated bio',
          avatarUrl: null,
          createdAt:
            '2026-09-25T10:00:00.000Z',
          updatedAt:
            '2026-09-25T12:00:00.000Z',
        },
      });

      expect(
        service.updateMyProfile,
      ).toHaveBeenCalledTimes(1);

      expect(
        service.updateMyProfile,
      ).toHaveBeenCalledWith(
        USER_ID,
        {
          displayName: 'Updated Customer',
          bio: 'Updated bio',
          avatarUrl: null,
        },
      );
    });

    it('allows updating only the display name', async () => {
      const service = createServiceMock();

      (
        service.updateMyProfile as jest.Mock
      ).mockResolvedValue({
        userId: USER_ID,
        displayName: 'New Name',
        bio: null,
        avatarUrl: null,
        createdAt: new Date(
          '2026-09-25T10:00:00.000Z',
        ),
        updatedAt: new Date(
          '2026-09-25T12:00:00.000Z',
        ),
      });

      const app = createTestApp(service);
      const token = createToken(USER_ID);

      await request(app)
        .patch('/users/me')
        .set(
          'Authorization',
          `Bearer ${token}`,
        )
        .send({
          displayName: 'New Name',
        })
        .expect(200);

      expect(
        service.updateMyProfile,
      ).toHaveBeenCalledWith(
        USER_ID,
        {
          displayName: 'New Name',
        },
      );
    });

    it('allows clearing the bio', async () => {
      const service = createServiceMock();

      (
        service.updateMyProfile as jest.Mock
      ).mockResolvedValue({
        userId: USER_ID,
        displayName: null,
        bio: null,
        avatarUrl: null,
        createdAt: new Date(
          '2026-09-25T10:00:00.000Z',
        ),
        updatedAt: new Date(
          '2026-09-25T12:00:00.000Z',
        ),
      });

      const app = createTestApp(service);
      const token = createToken(USER_ID);

      await request(app)
        .patch('/users/me')
        .set(
          'Authorization',
          `Bearer ${token}`,
        )
        .send({
          bio: null,
        })
        .expect(200);

      expect(
        service.updateMyProfile,
      ).toHaveBeenCalledWith(
        USER_ID,
        {
          bio: null,
        },
      );
    });

    it('rejects an empty profile update', async () => {
      const service = createServiceMock();
      const app = createTestApp(service);
      const token = createToken(USER_ID);

      const response = await request(app)
        .patch('/users/me')
        .set(
          'Authorization',
          `Bearer ${token}`,
        )
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe(
        'VALIDATION_ERROR',
      );

      expect(
        service.updateMyProfile,
      ).not.toHaveBeenCalled();
    });

    it('rejects an invalid avatar URL', async () => {
      const service = createServiceMock();
      const app = createTestApp(service);
      const token = createToken(USER_ID);

      const response = await request(app)
        .patch('/users/me')
        .set(
          'Authorization',
          `Bearer ${token}`,
        )
        .send({
          avatarUrl: 'not-a-url',
        })
        .expect(400);

      expect(response.body.error.code).toBe(
        'VALIDATION_ERROR',
      );

      expect(
        service.updateMyProfile,
      ).not.toHaveBeenCalled();
    });

    it('rejects unknown profile fields', async () => {
      const service = createServiceMock();
      const app = createTestApp(service);
      const token = createToken(USER_ID);

      const response = await request(app)
        .patch('/users/me')
        .set(
          'Authorization',
          `Bearer ${token}`,
        )
        .send({
          displayName: 'Customer',
          password:
            'should-not-be-accepted',
        })
        .expect(400);

      expect(response.body.error.code).toBe(
        'VALIDATION_ERROR',
      );

      expect(
        service.updateMyProfile,
      ).not.toHaveBeenCalled();
    });

    it('rejects a display name longer than 120 characters', async () => {
      const service = createServiceMock();
      const app = createTestApp(service);
      const token = createToken(USER_ID);

      const response = await request(app)
        .patch('/users/me')
        .set(
          'Authorization',
          `Bearer ${token}`,
        )
        .send({
          displayName: 'A'.repeat(121),
        })
        .expect(400);

      expect(response.body.error.code).toBe(
        'VALIDATION_ERROR',
      );

      expect(
        service.updateMyProfile,
      ).not.toHaveBeenCalled();
    });

    it('rejects a bio longer than 500 characters', async () => {
      const service = createServiceMock();
      const app = createTestApp(service);
      const token = createToken(USER_ID);

      const response = await request(app)
        .patch('/users/me')
        .set(
          'Authorization',
          `Bearer ${token}`,
        )
        .send({
          bio: 'A'.repeat(501),
        })
        .expect(400);

      expect(response.body.error.code).toBe(
        'VALIDATION_ERROR',
      );

      expect(
        service.updateMyProfile,
      ).not.toHaveBeenCalled();
    });
  });
});
