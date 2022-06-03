import RedisMock from "ioredis-mock";
import { ClientError } from "@lindorm-io/errors";
import { Redis } from "ioredis";
import { RedisConnection } from "@lindorm-io/redis";
import { assertRateLimit } from "./assert-rate-limit";
import { createMockLogger } from "@lindorm-io/winston";
import { getRateLimitKey } from "../util";

describe("assertRateLimit", () => {
  let connection: RedisConnection;
  let redis: Redis;
  let ctx: any;
  let options: any;

  const logger = createMockLogger();

  beforeAll(async () => {
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
  });

  afterAll(async () => {
    await connection.quit();
  });

  beforeEach(() => {
    ctx = {
      connection: { redis: connection },
    };

    options = {
      expiresInSeconds: 99,
      keyName: "name",
      limit: 100,
      value: "value",
    };
  });

  test("should resolve", async () => {
    await expect(assertRateLimit(ctx, options)).resolves.not.toThrow();
  });

  test("should reject", async () => {
    await redis.setex(getRateLimitKey("name", "value"), 90, 100);

    await expect(assertRateLimit(ctx, options)).rejects.toThrow(ClientError);
  });
});
