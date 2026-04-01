import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export const lookupRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(6, "60 s"),
  analytics: true,
  prefix: "ratelimit:lookup",
});