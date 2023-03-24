import { Metric } from "@lindorm-io/koa";
import { IMemoryDatabase, MemoryDatabase, TestMemoryCache } from "@lindorm-io/in-memory-cache";
import { createMockLogger } from "@lindorm-io/core-logger";
import { memoryCacheMiddleware } from "./memory-cache-middleware";

const next = () => Promise.resolve();

describe("memoryCacheMiddleware", () => {
  let ctx: any;
  let database: IMemoryDatabase;

  const logger = createMockLogger();

  beforeEach(() => {
    ctx = {
      logger,
      memory: {},
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);

    database = new MemoryDatabase();
  });

  test("should set cache on context", async () => {
    await expect(
      memoryCacheMiddleware(database, TestMemoryCache)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.memory.testMemoryCache).toStrictEqual(expect.any(TestMemoryCache));
    expect(ctx.metrics.memory).toStrictEqual(expect.any(Number));
  });

  test("should set cache with specific key", async () => {
    await expect(
      memoryCacheMiddleware(database, TestMemoryCache, { cacheKey: "otherKey" })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.memory.otherKey).toStrictEqual(expect.any(TestMemoryCache));
    expect(ctx.metrics.memory).toStrictEqual(expect.any(Number));
  });
});
