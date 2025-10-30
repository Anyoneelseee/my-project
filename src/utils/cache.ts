// utils/cache.ts
import crypto from "crypto";
import type { Redis } from "@upstash/redis";
// @ts-expect-error - suppress missing type definitions for redis
import type { RedisClientType } from "redis";

type RedisClient = RedisClientType | Redis;

let redisClient: RedisClient | null = null;
let redisPromise: Promise<RedisClient> | null = null;

/**
 * Generate a stable SHA-256 hash for code snippets
 */
const hashCode = (code: string): string =>
  crypto.createHash("sha256").update(code.trim()).digest("hex");

/**
 * Initialize Redis client (singleton with race protection)
 */
async function initRedis(): Promise<RedisClient> {
  if (redisPromise) return redisPromise;

  redisPromise = (async () => {
    const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

    if (isProd) {
      const { Redis } = await import("@upstash/redis");
      if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required");
      }
      const client = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      console.log("✅ Upstash Redis connected");
      return client;
    } else {
      // @ts-expect-error - redis types missing, but valid at runtime
      const { createClient } = await import("redis");
      const client = createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
      });

      // Explicitly type the error as unknown
      client.on("error", (err: unknown) => {
        console.error("❌ Local Redis error:", err);
      });

      await client.connect();
      console.log("✅ Local Redis connected");
      return client;
    }
  })();

  return redisPromise;
}

/**
 * Get Redis client (singleton)
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
  try {
    const redis = await getRedis();
    const hash = hashCode(code);
    const key = `ai:${hash}`;

    let cached: string | null = null;
    if ("get" in redis && typeof redis.get === "function") {
      cached = await (redis as Redis).get(key);
    } else if ("call" in redis) {
      cached = await redis.call("GET", key);
    }

    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch (err) {
    console.warn("⚠️ Cache read failed:", err);
    return null;
  }
};

/**
 * Store AI result in cache (1 hour)
 */
export const setCachedAI = async <T>(code: string, result: T): Promise<void> => {
  try {
    const redis = await getRedis();
    const hash = hashCode(code);
    const key = `ai:${hash}`;
    const data = JSON.stringify(result);

    if ("setEx" in redis && typeof redis.setEx === "function") {
      await (redis as RedisClientType).setEx(key, 3600, data);
    } else if ("set" in redis && typeof redis.set === "function") {
      await (redis as Redis).set(key, data, { ex: 3600 });
    }
  } catch (err) {
    console.warn("⚠️ Cache write failed:", err);
  }
};

/**
 * Invalidate cache for a code snippet
 */
export const invalidateAI = async (code: string): Promise<void> => {
  try {
    const redis = await getRedis();
    const hash = hashCode(code);
    const key = `ai:${hash}`;
    if ("del" in redis) {
      await redis.del(key);
    }
  } catch (err) {
    console.warn("⚠️ Cache invalidation failed:", err);
  }
};
