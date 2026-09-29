import memjs from "memjs";

export class MemcachedService {
  private client: memjs.Client;
  private ttlSeconds: number;

  constructor() {
    const host = process.env.MEMCACHED_HOST || "localhost";
    const port = process.env.MEMCACHED_PORT || "11211";

    this.client = memjs.Client.create(`${host}:${port}`);

    this.ttlSeconds = Number(
      process.env.MEMCACHED_TTL_SECONDS || "60"
    );
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await this.client.get(key);

      if (!result.value) {
        return null;
      }

      return JSON.parse(result.value.toString()) as T;
    } catch (error) {
      console.error(
        `Memcached GET failed for key ${key}:`,
        error
      );

      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds = this.ttlSeconds
  ): Promise<void> {
    try {
      await this.client.set(
        key,
        JSON.stringify(value),
        {
          expires: ttlSeconds
        }
      );
    } catch (error) {
      console.error(
        `Memcached SET failed for key ${key}:`,
        error
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.delete(key);
    } catch (error) {
      console.error(
        `Memcached DELETE failed for key ${key}:`,
        error
      );
    }
  }
}
