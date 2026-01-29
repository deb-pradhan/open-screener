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
  async del(key: string): Promise<void> {
    if (!redisClient || !redisAvailable) return;
    try {
      await redisClient.del(key);
    } catch {
      // Ignore
    }
  },
};

// Key prefixes for organization
export const REDIS_KEYS = {
  TICKER_INDICATORS: 'indicators:', // indicators:{symbol}
  SCREENER_RESULTS: 'screener:', // screener:{filterId}
  TICKER_SNAPSHOT: 'snapshot:', // snapshot:{symbol}
  RATE_LIMIT: 'ratelimit:', // ratelimit:{ip}
  // Yahoo Finance specific
  YAHOO_TICKER: 'yahoo:ticker:', // yahoo:ticker:{symbol}
  YAHOO_QUOTE: 'yahoo:quote:', // yahoo:quote:{symbol}
  YAHOO_PROFILE: 'yahoo:profile:', // yahoo:profile:{symbol}
  YAHOO_STATS: 'yahoo:stats:', // yahoo:stats:{symbol}
  YAHOO_EARNINGS: 'yahoo:earnings:', // yahoo:earnings:{symbol}
  YAHOO_ANALYSTS: 'yahoo:analysts:', // yahoo:analysts:{symbol}
  YAHOO_HOLDERS: 'yahoo:holders:', // yahoo:holders:{symbol}
} as const;

// TTL values in seconds
export const REDIS_TTL = {
  INDICATORS: 300, // 5 minutes
  SNAPSHOT: 60, // 1 minute
  SCREENER_RESULTS: 30, // 30 seconds
  // Yahoo Finance TTLs
  YAHOO_QUOTE: 60, // 1 minute - real-time price data
  YAHOO_PROFILE: 86400, // 24 hours - company info rarely changes
  YAHOO_STATS: 3600, // 1 hour - financial stats
  YAHOO_EARNINGS: 3600, // 1 hour - earnings data
  YAHOO_ANALYSTS: 3600, // 1 hour - analyst recommendations
  YAHOO_HOLDERS: 86400, // 24 hours - institutional holdings
  YAHOO_TICKER_FULL: 300, // 5 minutes - full ticker data bundle
} as const;
