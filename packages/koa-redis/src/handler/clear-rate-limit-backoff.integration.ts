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
      port: 6377,
      logger,
    });

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
    await expect(clearRateLimitBackoff(ctx, options)).resolves.not.toThrow();
  });
});
