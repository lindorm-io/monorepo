import { Logger } from "@lindorm-io/winston";
import { RedisConnection } from "@lindorm-io/redis";
import { config } from "dotenv";

config();

export const getRedis = (winston: Logger): RedisConnection =>
  new RedisConnection({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10),
    username: process.env.REDIS_PASSWORD,
    password: process.env.REDIS_PASSWORD,
    winston,
  });
