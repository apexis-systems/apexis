import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || '6379';
const redisUrl = process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`;

const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
        // Wait up to 2 seconds between reconnects to allow DNS time to propagate
        return Math.min(times * 100, 2000); 
    },
    reconnectOnError: (err) => {
        if (err.message.includes('READONLY')) {
            console.log('Redis READONLY error detected, forcing reconnect...');
            return 2; 
        }
        return false;
    }
});

redis.on("error", (err) => {
    console.error("Redis connection error:", err);
});

redis.on("connect", () => {
    console.log("Connected to Redis successfully.");
});

export default redis;
