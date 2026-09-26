describe('config loader', () => {
  it('loads and validates configuration from environment variables', async () => {
    const { loadFromEnvironment } = await import('../src/config/config.loader');

    try {
      const config = loadFromEnvironment();

      expect(config.serviceName).toBe('auth-service');
      expect(config.dbSchema).toBe('auth_schema');
      expect(config.jwtSecret).toBeTruthy();
      expect(config.databaseUrl).toBeTruthy();
    } catch (error) {
      console.error('CONFIG LOADER ERROR:', error);
      throw error;
    }
  });
});
