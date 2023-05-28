import { ClientError } from "@lindorm-io/errors";
import { createMockRedisConnection } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { verifyAssertionId } from "./verify-assertion-id";

describe("verifyAssertionId", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      connection: {
        redis: createMockRedisConnection(),
      },
      logger: createMockLogger(),
    };
  });

  test("should resolve when no assertionId", async () => {
    ctx.connection.redis.client.get.mockResolvedValue(null);

    await expect(verifyAssertionId(ctx)).resolves.toBeUndefined();
  });

  test("should store new assertionId", async () => {
    ctx.connection.redis.client.get.mockResolvedValue(null);

    await expect(verifyAssertionId(ctx, "assertion-id")).resolves.toBeUndefined();

    expect(ctx.connection.redis.client.setex).toHaveBeenCalledWith(
      "lindorm_io_oauth_service_assertion_id:assertion-id",
      3600,
      1,
    );
  });

  test("should throw when assertionId is already consumed", async () => {
    ctx.connection.redis.client.get.mockResolvedValue(1);

    await expect(verifyAssertionId(ctx, "assertion-id")).rejects.toThrow(expect.any(ClientError));
  });
});
