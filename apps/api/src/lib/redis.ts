import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis client with lazy connect and suppressed errors for dev mode
let redisClient: Redis | null = null;
let redisAvailable = false;

try {
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('Redis unavailable - running without cache');
        return null; // Stop retrying
      }
      return Math.min(times * 100, 1000);
    },
    lazyConnect: true,
  });

  redisClient.on('error', () => {
    // Suppress repeated error logs
    if (redisAvailable) {
      console.warn('Redis connection lost');
      redisAvailable = false;
    }
  });

  redisClient.on('connect', () => {
    console.log('Connected to Redis');
    redisAvailable = true;
  });

  // Try to connect
  redisClient.connect().catch(() => {
    console.warn('Redis not available - running without cache');
  });
} catch {
  console.warn('Redis not configured - running without cache');
}

// Proxy that gracefully handles missing Redis
export const redis = {
  async get(key: string): Promise<string | null> {
    if (!redisClient || !redisAvailable) return null;
    try {
      return await redisClient.get(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (!redisClient || !redisAvailable) return;
    try {
      await redisClient.set(key, value);
    } catch {
      // Ignore
    }
  },
  async setex(key: string, seconds: number, value: string): Promise<void> {
    if (!redisClient || !redisAvailable) return;
    try {
      await redisClient.setex(key, seconds, value);
    } catch {
      // Ignore
    }
  },
  async keys(pattern: string): Promise<string[]> {
    if (!redisClient || !redisAvailable) return [];
    try {
      return await redisClient.keys(pattern);
    } catch {
      return [];
    }
  },
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (!redisClient || !redisAvailable || keys.length === 0) return [];
    try {
      return await redisClient.mget(keys);
    } catch {
      return [];
    }
  },
};

// Key prefixes for organization
export const REDIS_KEYS = {
  TICKER_INDICATORS: 'indicators:', // indicators:{symbol}
  SCREENER_RESULTS: 'screener:', // screener:{filterId}
  TICKER_SNAPSHOT: 'snapshot:', // snapshot:{symbol}
  RATE_LIMIT: 'ratelimit:', // ratelimit:{ip}
} as const;

// TTL values in seconds
export const REDIS_TTL = {
  INDICATORS: 300, // 5 minutes
  SNAPSHOT: 60, // 1 minute
  SCREENER_RESULTS: 30, // 30 seconds
} as const;
