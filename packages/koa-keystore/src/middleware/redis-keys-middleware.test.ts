import { createMockLogger } from "@lindorm-io/core-logger";
import { createTestStoredKeySetEc, createTestStoredKeySetRsa } from "@lindorm-io/keystore";
import { Metric } from "@lindorm-io/koa";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { redisKeysMiddleware } from "./redis-keys-middleware";

const next = () => Promise.resolve();

describe("cacheKeysMiddleware", () => {
  let ctx: any;

  const logger = createMockLogger();
  const keyEC = createTestStoredKeySetEc();
  const keyRSA = createTestStoredKeySetRsa();

  beforeEach(async () => {
    ctx = {
      keys: [keyEC.webKeySet],
      logger,
      metrics: {},
      redis: {
        storedKeySetRedisRepository: createMockRedisRepository(() => keyRSA),
      },
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should successfully add keys to context", async () => {
    await expect(redisKeysMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.keys).toStrictEqual([keyEC.webKeySet, keyRSA.webKeySet]);
    expect(ctx.metrics.keystore).toStrictEqual(expect.any(Number));
  });
});
