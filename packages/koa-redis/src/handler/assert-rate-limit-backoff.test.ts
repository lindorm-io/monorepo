import RedisMock from "ioredis-mock";
import { ClientError } from "@lindorm-io/errors";
import { Redis } from "ioredis";
import { RedisConnection } from "@lindorm-io/redis";
import { assertRateLimitBackoff } from "./assert-rate-limit-backoff";
import { createMockLogger } from "@lindorm-io/winston";
import { getRateLimitBackoffExpireKey } from "../util";

describe("assertRateLimitBackoff", () => {
  let connection: RedisConnection;
  let redis: Redis;
  let ctx: any;
  let options: any;

  const logger = createMockLogger();

  beforeEach(async () => {
    connection = new RedisConnection({
      host: "localhost",
      port: 6379,
      winston: logger,
      customClient: new RedisMock({
        host: "localhost",
        port: 6379,
      }) as Redis,
    });

    await connection.waitForConnection();

    redis = connection.client();

    ctx = {
      connection: { redis: connection },
    };

    options = {
      keyName: "name",
      value: "value",
    };
  });

  afterEach(async () => {
    await connection.quit();
  });

  test("should resolve", async () => {
    await expect(assertRateLimitBackoff(ctx, options)).resolves.not.toThrow();
  });

  test("should throw", async () => {
    await redis.setex(getRateLimitBackoffExpireKey("name", "value"), 99, 1);

    await expect(assertRateLimitBackoff(ctx, options)).rejects.toThrow(ClientError);
  });
});
