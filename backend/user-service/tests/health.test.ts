import request from 'supertest';

import { createApp } from '../src/app';

describe('GET /health', () => {
  it('returns a healthy user-service response', async () => {
    const app = createApp({
      userProfileService: {
        getMyProfile: async () => null,

        updateMyProfile: async () => {
          throw new Error('Not used');
        }
      } as any
    });

    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'user-service'
    });
  });
});
