import { RedisConnection } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { getRateLimitBackoffAttemptKey } from "../util";
import { setRateLimitBackoff } from "./set-rate-limit-backoff";

describe("setRateLimitBackoff", () => {
  let connection: RedisConnection;
  let ctx: any;
  let options: any;

  const logger = createMockLogger();

  beforeEach(async () => {
    connection = new RedisConnection(
      {
        host: "localhost",
        port: 5007,
      },
      logger,
    );

    await connection.connect();

    ctx = {
      connection: { redis: connection },
    };

    options = {
      keyName: "name",
      value: "value",
    };
  });

  afterEach(async () => {
    await connection.disconnect();
  });

  test("should resolve retriesLeft", async () => {
    await expect(setRateLimitBackoff(ctx, options)).resolves.toStrictEqual({
      retriesLeft: 4,
    });
  });

  test("should resolve retriesLeft", async () => {
    await connection.client.setex(getRateLimitBackoffAttemptKey("name", "value"), 99, 2);

    await expect(setRateLimitBackoff(ctx, options)).resolves.toStrictEqual({
      retriesLeft: 2,
    });
  });

  test("should resolve retryIn", async () => {
    await connection.client.setex(getRateLimitBackoffAttemptKey("name", "value"), 99, 4);

    await expect(setRateLimitBackoff(ctx, options)).resolves.toStrictEqual({
      retryIn: 60,
    });
  });

  test("should resolve retryIn", async () => {
    await connection.client.setex(getRateLimitBackoffAttemptKey("name", "value"), 99, 5);

    await expect(setRateLimitBackoff(ctx, options)).resolves.toStrictEqual({
      retryIn: 180,
    });
  });
});
