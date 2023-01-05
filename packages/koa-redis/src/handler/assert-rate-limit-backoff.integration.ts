import { ClientError } from "@lindorm-io/errors";
import { RedisConnection } from "@lindorm-io/redis";
import { assertRateLimitBackoff } from "./assert-rate-limit-backoff";
import { createMockLogger } from "@lindorm-io/core-logger";
import { getRateLimitBackoffExpireKey } from "../util";

describe("assertRateLimitBackoff", () => {
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

  test("should resolve", async () => {
    await expect(assertRateLimitBackoff(ctx, options)).resolves.not.toThrow();
  });

  test("should throw", async () => {
    await connection.client.setex(getRateLimitBackoffExpireKey("name", "value"), 99, 1);

    await expect(assertRateLimitBackoff(ctx, options)).rejects.toThrow(ClientError);
  });
});
