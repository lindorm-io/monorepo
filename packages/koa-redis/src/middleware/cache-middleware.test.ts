import { Metric } from "@lindorm-io/koa";
import { TestCache } from "@lindorm-io/redis";
import { cacheMiddleware } from "./cache-middleware";
import { createMockLogger } from "@lindorm-io/winston";

const next = () => Promise.resolve();

describe("cacheMiddleware", () => {
  let ctx: any;

  const logger = createMockLogger();

  beforeEach(() => {
    ctx = {
      connection: { redis: { client: () => "client" } },
      logger,
      metrics: {},
      cache: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should set cache on context", async () => {
    await expect(cacheMiddleware(TestCache)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.cache.testCache).toStrictEqual(expect.any(TestCache));
    expect(ctx.metrics.redis).toStrictEqual(expect.any(Number));
  });

  test("should set cache with specific key", async () => {
    await expect(
      cacheMiddleware(TestCache, { cacheKey: "otherKey" })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.cache.otherKey).toStrictEqual(expect.any(TestCache));
    expect(ctx.metrics.redis).toStrictEqual(expect.any(Number));
  });
});
