// utils/cache.ts
import crypto from "crypto";
import type { Redis } from "@upstash/redis";
// @ts-expect-error - suppress missing type definitions for redis
import type { RedisClientType } from "redis";

// Minimal type for Redis clients that support .call() or .connect()
interface LegacyRedisClient {
  connect?: () => Promise<void>;
  call?: (command: string, key: string) => Promise<string | null>;
  on?: (event: string, listener: (err: unknown) => void) => void;
  del?: (key: string) => Promise<void>;
}

type RedisClient = Redis | RedisClientType | LegacyRedisClient | null;

let redisClient: RedisClient = null;
let redisPromise: Promise<RedisClient> | null = null;

/**
 * Generate a stable SHA-256 hash for code snippets
 */
const hashCode = (code: string): string =>
  crypto.createHash("sha256").update(code.trim()).digest("hex");

/**
 * Initialize Redis client (singleton with race protection)
 * - In production: Upstash (serverless, no .connect())
 * - In dev: Only if REDIS_URL exists, otherwise disabled
 */
async function initRedis(): Promise<RedisClient> {
  if (redisPromise) return redisPromise;

  redisPromise = (async () => {
    const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

    if (isProd) {
      // === PRODUCTION: Upstash Redis (HTTP-based) ===
      const { Redis } = await import("@upstash/redis");
      if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        console.warn("Upstash Redis not configured — caching disabled in production");
        return null;
      }
      const client = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      console.log("✅ Upstash Redis ready (production)");
      return client;
    } else {
      // === DEVELOPMENT: Local Redis (optional) ===
      if (!process.env.REDIS_URL) {
        console.log("No REDIS_URL — caching disabled in development (normal)");
        return null;
      }

      try {
        // @ts-expect-error - missing redis types
        const { createClient } = await import("redis");
        const client: LegacyRedisClient = createClient({
          url: process.env.REDIS_URL,
        });

        if (client.on) {
          client.on("error", (err: unknown) => {
            console.warn("Local Redis error:", err);
          });
        }

        // Only call connect if it exists (safe guard)
        if (typeof client.connect === "function") {
          await client.connect();
          console.log("✅ Local Redis connected");
        } else {
          console.log("⚠️ Local Redis client created (no .connect method)");
        }

        return client;
      } catch (err) {
        console.warn("Failed to connect to local Redis — caching disabled:", err);
        return null;
      }
    }
  })();

  return redisPromise;
}

/**
 * Get Redis client (singleton) — returns null if not available
 */
async function getRedis(): Promise<RedisClient> {
  if (!redisClient) {
    redisClient = await initRedis();
  }
  return redisClient;
}

/**
 * Retrieve cached AI result
 */
export const getCachedAI = async <T>(code: string): Promise<T | null> => {
  const redis = await getRedis();
  if (!redis) return null;

  try {
    const hash = hashCode(code);
    const key = `ai:${hash}`;

    let cached: string | null = null;

    // Upstash Redis: .get()
    if ("get" in redis && typeof redis.get === "function") {
      cached = await redis.get(key);
    }
    // Local Redis: .call("GET", key)
    else if ("call" in redis && typeof redis.call === "function") {
      cached = await redis.call("GET", key);
    }

    if (!cached) {
      console.log(`Cache MISS for key: ${key}`);
      return null;
    }

    console.log(`Cache HIT for key: ${key}`);
    return JSON.parse(cached) as T;
  } catch (err) {
    console.warn("Cache read failed:", err);
    return null;
  }
};

/**
 * Store AI result in cache (1 hour TTL)
 */
export const setCachedAI = async <T>(code: string, result: T): Promise<void> => {
  const redis = await getRedis();
  if (!redis) return;

  try {
    const hash = hashCode(code);
    const key = `ai:${hash}`;
    const data = JSON.stringify(result);

    // Local Redis: .setEx()
    if ("setEx" in redis && typeof redis.setEx === "function") {
      await redis.setEx(key, 3600, data);
    }
    // Upstash Redis: .set(..., { ex: 3600 })
    else if ("set" in redis && typeof redis.set === "function") {
      await redis.set(key, data, { ex: 3600 });
    }

    console.log(`Cache SET for key: ${key}`);
  } catch (err) {
    console.warn("Cache write failed:", err);
  }
};

/**
 * Invalidate cache for a code snippet
 */
export const invalidateAI = async (code: string): Promise<void> => {
  const redis = await getRedis();
  if (!redis) return;

  try {
    const hash = hashCode(code);
    const key = `ai:${hash}`;
    if ("del" in redis && typeof redis.del === "function") {
      await redis.del(key);
      console.log(`Cache DELETED: ${key}`);
    }
  } catch (err) {
    console.warn("Cache invalidation failed:", err);
  }
};
