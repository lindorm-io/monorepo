import { Metric } from "@lindorm-io/koa";
import { TestRedisRepository } from "@lindorm-io/redis";
import { redisRepositoryMiddleware } from "./redis-repository-middleware";
import { createMockLogger } from "@lindorm-io/core-logger";

const next = () => Promise.resolve();

describe("redisRepositoryMiddleware", () => {
  let ctx: any;

  const logger = createMockLogger();

  beforeEach(() => {
    ctx = {
      connection: { redis: { client: () => "client" } },
      logger,
      metrics: {},
      redis: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should set repository on context", async () => {
    await expect(
      redisRepositoryMiddleware(TestRedisRepository)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.redis.testRedisRepository).toStrictEqual(expect.any(TestRedisRepository));
    expect(ctx.metrics.redis).toStrictEqual(expect.any(Number));
  });

  test("should set repository with specific key", async () => {
    await expect(
      redisRepositoryMiddleware(TestRedisRepository, { repositoryKey: "otherKey" })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.redis.otherKey).toStrictEqual(expect.any(TestRedisRepository));
    expect(ctx.metrics.redis).toStrictEqual(expect.any(Number));
  });
});
