import { ClientError } from "@lindorm-io/errors";
import { RedisConnection } from "@lindorm-io/redis";
import { assertRateLimit } from "./assert-rate-limit";
import { createMockLogger } from "@lindorm-io/winston";
import { getRateLimitKey } from "../util";

describe("assertRateLimit", () => {
  let connection: RedisConnection;
  let ctx: any;
  let options: any;

  const logger = createMockLogger();

  beforeAll(async () => {
    connection = new RedisConnection(
      {
        host: "localhost",
        port: 5007,
      },
      logger,
    );

    await connection.connect();
  });

  afterAll(async () => {
    await connection.disconnect();
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
    await connection.client.setex(getRateLimitKey("name", "value"), 90, 100);

    await expect(assertRateLimit(ctx, options)).rejects.toThrow(ClientError);
  });
});
