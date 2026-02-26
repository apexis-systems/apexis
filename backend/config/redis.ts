import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// Default to localhost fallback if env var is missing
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
});

redis.on("error", (err) => {
    console.error("Redis connection error:", err);
});

redis.on("connect", () => {
    console.log("Connected to Redis successfully.");
});

export default redis;
