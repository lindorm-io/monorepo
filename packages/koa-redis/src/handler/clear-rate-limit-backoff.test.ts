import RedisMock from "ioredis-mock";
import { Redis } from "ioredis";
import { RedisConnection } from "@lindorm-io/redis";
import { clearRateLimitBackoff } from "./clear-rate-limit-backoff";
import { createMockLogger } from "@lindorm-io/winston";

describe("clearRateLimitBackoff", () => {
  let connection: RedisConnection;
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
    await expect(clearRateLimitBackoff(ctx, options)).resolves.not.toThrow();
  });
});
